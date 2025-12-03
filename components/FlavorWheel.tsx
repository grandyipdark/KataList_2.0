
import React, { useState, useMemo } from 'react';
import { FLAVOR_WHEEL_DATA, FlavorNode } from '../utils/flavorWheelData';
import { Icon } from './Shared';

interface FlavorWheelProps {
    onSelectTag: (tag: string) => void;
}

// Helper to determine text color (White vs Slate-900) based on background brightness
const getContrastColor = (hexColor: string) => {
    // Default to white if invalid
    if (!hexColor || !hexColor.startsWith('#')) return '#ffffff';
    
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    
    // YIQ equation
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    
    // If bright (>128), return dark text. Else white.
    return yiq >= 160 ? '#0f172a' : '#ffffff'; // Threshold 160 covers pastels better
};

export const FlavorWheel = React.memo(({ onSelectTag }: FlavorWheelProps) => {
    const [history, setHistory] = useState<FlavorNode[]>([]);
    const [currentNode, setCurrentNode] = useState<FlavorNode | null>(null);

    // If currentNode is null, we are at Root
    const activeData = currentNode ? (currentNode.children || []) : FLAVOR_WHEEL_DATA;
    const isRoot = !currentNode;

    // --- HEXAGON GEOMETRY ---
    const HEX_SIZE = 28; // Radius of a single hexagon
    const ORBIT_RADIUS = 65; // Distance from center for the ring

    // Generate points for a hexagon polygon
    const getHexPoints = (radius: number) => {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle_deg = 60 * i - 30; // Pointy topped
            const angle_rad = Math.PI / 180 * angle_deg;
            points.push(`${radius * Math.cos(angle_rad)},${radius * Math.sin(angle_rad)}`);
        }
        return points.join(' ');
    };

    const hexPoints = useMemo(() => getHexPoints(HEX_SIZE), []);
    // Slightly larger hex for the center
    const centerHexPoints = useMemo(() => getHexPoints(HEX_SIZE * 1.1), []);

    // --- LAYOUT CALCULATION ---
    const hexNodes = useMemo(() => {
        const total = activeData.length;
        
        // Adjust orbit radius slightly if there are many items to prevent overlap
        const currentOrbit = total > 6 ? ORBIT_RADIUS + 5 : ORBIT_RADIUS;
        
        return activeData.map((node, index) => {
            // Distribute in a circle starting from top (-90deg)
            const angle = (index / total) * 2 * Math.PI - (Math.PI / 2);
            
            const x = currentOrbit * Math.cos(angle);
            const y = currentOrbit * Math.sin(angle);

            return {
                node,
                x,
                y,
                color: node.color
            };
        });
    }, [activeData]);

    const handleNodeClick = (node: FlavorNode) => {
        if (node.children && node.children.length > 0) {
            setHistory(prev => currentNode ? [...prev, currentNode] : [...prev]);
            setCurrentNode(node);
        } else {
            onSelectTag(node.name);
        }
    };

    const handleBack = () => {
        if (history.length > 0) {
            const prev = history[history.length - 1];
            setHistory(prevHist => prevHist.slice(0, -1));
            setCurrentNode(prev);
        } else {
            setCurrentNode(null);
        }
    };

    // Text splitting logic for hexagons
    const renderHexText = (name: string, bgColor: string, isCenter: boolean = false) => {
        const words = name.split(' ');
        let lines = [name];
        
        // Split into max 2 lines
        if (name.length > 8 && words.length > 1) {
            const mid = Math.floor(words.length / 2);
            lines = [
                words.slice(0, mid).join(' '),
                words.slice(mid).join(' ')
            ];
        }

        const fontSize = isCenter ? 7 : 6;
        const lineHeight = fontSize * 1.2;
        const startY = -((lines.length - 1) * lineHeight) / 2;
        
        // Dynamic color calculation
        const textColor = isCenter && isRoot ? '#94a3b8' : getContrastColor(bgColor);

        return (
            <text
                className="pointer-events-none select-none font-bold uppercase tracking-tight"
                fill={textColor}
                fontSize={fontSize}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ textShadow: textColor === '#ffffff' ? '0px 1px 2px rgba(0,0,0,0.5)' : 'none' }}
            >
                {lines.map((line, i) => (
                    <tspan key={i} x="0" y={startY + (i * lineHeight) + 1}>
                        {line}
                    </tspan>
                ))}
            </text>
        );
    };

    const centerColor = currentNode ? currentNode.color : "#1e293b";

    return (
        <div className="w-full aspect-square max-w-[350px] mx-auto relative select-none animate-fade-in flex items-center justify-center">
            {/* SVG ViewBox: centered at 0,0. Size 200x200 ensures margin for orbit */}
            <svg viewBox="-100 -100 200 200" className="w-full h-full drop-shadow-xl overflow-visible">
                
                {/* 1. SATELLITE NODES (Children) */}
                {hexNodes.map((hex, i) => (
                    <g 
                        key={hex.node.name + i} 
                        transform={`translate(${hex.x}, ${hex.y})`}
                        onClick={(e) => { e.stopPropagation(); handleNodeClick(hex.node); }}
                        className="cursor-pointer group"
                    >
                        {/* Shadow Hex */}
                        <polygon points={hexPoints} fill="rgba(0,0,0,0.2)" transform="translate(1, 2)" />
                        
                        {/* Main Hex - Scale applied HERE with correct origin */}
                        <polygon 
                            points={hexPoints} 
                            fill={hex.color} 
                            stroke="#0f172a" 
                            strokeWidth="1.5"
                            className="transition-transform duration-200 ease-out group-hover:scale-105"
                            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                        />
                        
                        {/* Shine Effect */}
                        <path d={`M -${HEX_SIZE/2} -${HEX_SIZE/2} L 0 -${HEX_SIZE} L ${HEX_SIZE/2} -${HEX_SIZE/2}`} stroke="white" strokeWidth="1" strokeOpacity="0.3" fill="none" className="pointer-events-none" />
                        
                        {renderHexText(hex.node.name, hex.color)}
                    </g>
                ))}

                {/* 2. CENTER NODE (Navigation/Context) */}
                <g 
                    onClick={(e) => { e.stopPropagation(); handleBack(); }} 
                    className="cursor-pointer group"
                >
                    {/* Ring glow if active */}
                    {!isRoot && (
                        <circle r={HEX_SIZE * 1.3} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4 2" className="animate-spin-slow" />
                    )}

                    <polygon 
                        points={centerHexPoints} 
                        fill={centerColor} 
                        stroke="#334155" 
                        strokeWidth="3"
                        className="transition-transform duration-200 ease-out group-hover:scale-105"
                        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                    />
                    
                    {isRoot ? (
                        <g transform="translate(-12, -12)" className="pointer-events-none">
                            <Icon name="reply" className="text-2xl text-slate-500" />
                        </g>
                    ) : (
                        <>
                            {/* Small back icon indicator at top */}
                            <path d="M 0 -18 L -3 -14 L 3 -14 Z" fill={getContrastColor(centerColor)} opacity="0.8" />
                            {renderHexText(currentNode?.name || '', centerColor, true)}
                        </>
                    )}
                </g>

            </svg>
            
            {/* Helper Text Footer */}
            {!isRoot && (
                <div className="absolute bottom-0 w-full text-center pointer-events-none">
                    <p className="text-[10px] text-slate-400 opacity-60">Toca el centro para volver</p>
                </div>
            )}
        </div>
    );
});

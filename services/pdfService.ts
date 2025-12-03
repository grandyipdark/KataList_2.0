import { Tasting } from "../types";
import { getProfileLabels } from "../utils/helpers";

export const generateTastingPDF = async (tasting: Tasting, imageBase64?: string): Promise<void> => {
    try {
        const module = await import("jspdf");
        const jsPDF = module.jsPDF || (module as any).default;
        
        if (!jsPDF) {
            throw new Error("Could not load jsPDF library");
        }

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15; // Tight margins for compact layout
        const contentWidth = pageWidth - (margin * 2);
        
        let currentY = 20;

        // --- Helper for Page Breaks ---
        const checkPageBreak = (heightNeeded: number) => {
            if (currentY + heightNeeded > pageHeight - margin) {
                doc.addPage();
                currentY = 20; // Reset Y for new page
                return true;
            }
            return false;
        };

        // --- Header ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(0);
        
        const titleLines = doc.splitTextToSize(tasting.name, contentWidth - 30); 
        doc.text(titleLines, margin, currentY);
        
        // Score Badge
        doc.setDrawColor(tasting.score >= 8 ? 0 : 200, tasting.score >= 8 ? 150 : 200, 0);
        doc.setFillColor(tasting.score >= 8 ? 240 : 255, tasting.score >= 8 ? 255 : 250, tasting.score >= 8 ? 240 : 200);
        doc.circle(pageWidth - 25, 22, 10, 'FD');
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text(tasting.score.toString(), pageWidth - 25, 23.5, { align: 'center' });

        currentY += (titleLines.length * 9) + 2;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(100);
        const subtitle = `${tasting.category} ${tasting.subcategory ? `• ${tasting.subcategory}` : ''} • ${tasting.country}`;
        doc.text(subtitle, margin, currentY);
        currentY += 10; 

        // --- Tri-Column Layout (Image | Data | Radar) ---
        // Image: Left (50mm width)
        // Data: Center (60mm width)
        // Radar: Right (50mm width)
        
        const startRowY = currentY;
        const col1W = 50;
        const col2W = 70;
        const col3W = 45;
        const colGap = 5;

        // 1. Image (Left)
        if (imageBase64) {
            try {
                doc.addImage(imageBase64, 'JPEG', margin, startRowY, col1W, col1W, undefined, 'FAST');
            } catch (e) {
                doc.setDrawColor(200);
                doc.rect(margin, startRowY, col1W, col1W);
            }
        } else {
            doc.setDrawColor(200);
            doc.rect(margin, startRowY, col1W, col1W);
        }

        // 2. Technical Data (Center)
        let specY = startRowY;
        const specX = margin + col1W + colGap;
        const lineHeight = 5.5; // Tighter line height
        
        const specs = [
            { label: "Productor", value: tasting.producer },
            { label: "Variedad", value: tasting.variety },
            { label: "Región", value: tasting.region },
            { label: "Añada", value: tasting.vintage },
            { label: "ABV", value: tasting.abv ? `${tasting.abv}%` : '' },
            { label: "Precio", value: tasting.price },
            { label: "Lugar", value: tasting.location },
            { label: "Fecha", value: new Date(tasting.createdAt).toLocaleDateString() }
        ];

        specs.forEach(spec => {
            if (spec.value) {
                doc.setFontSize(8); // Small font for labels
                doc.setFont("helvetica", "bold");
                doc.setTextColor(50);
                doc.text(`${spec.label}:`, specX, specY);
                
                doc.setFont("helvetica", "normal");
                doc.setTextColor(0);
                // Offset value slightly right
                doc.text(spec.value.toString(), specX + 22, specY);
                specY += lineHeight;
            }
        });

        // 3. Radar Chart (Right) - COMPACT
        if (tasting.profile) {
            const chartCenterX = margin + col1W + colGap + col2W + (col3W / 2);
            const chartCenterY = startRowY + 25;
            const radius = 18; 
            const maxVal = 5;

            // Axis & Web
            doc.setDrawColor(220);
            doc.setLineWidth(0.1);
            for (let level = 1; level <= 5; level++) {
                const points: [number, number][] = [];
                for (let i = 0; i < 5; i++) {
                    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                    const r = (level / maxVal) * radius;
                    points.push([chartCenterX + r * Math.cos(angle), chartCenterY + r * Math.sin(angle)]);
                }
                points.push(points[0]);
                for(let i=0; i<5; i++) doc.line(points[i][0], points[i][1], points[i+1][0], points[i+1][1]);
            }
            // Axis Lines
            const labels = getProfileLabels(tasting.category);
            for(let i=0; i<5; i++) {
                const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                const x = chartCenterX + radius * Math.cos(angle);
                const y = chartCenterY + radius * Math.sin(angle);
                doc.line(chartCenterX, chartCenterY, x, y);
                // Labels
                const labelX = chartCenterX + (radius + 4) * Math.cos(angle);
                const labelY = chartCenterY + (radius + 4) * Math.sin(angle);
                doc.setFontSize(6);
                doc.setTextColor(100);
                doc.text(labels[i], labelX, labelY, { align: 'center', baseline: 'middle' });
            }
            // Profile Polygon
            const values = [tasting.profile.p1, tasting.profile.p2, tasting.profile.p3, tasting.profile.p4, tasting.profile.p5];
            const dataPoints: [number, number][] = values.map((v, i) => {
                const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                const r = (v / maxVal) * radius;
                return [chartCenterX + r * Math.cos(angle), chartCenterY + r * Math.sin(angle)];
            });
            doc.setDrawColor(0, 0, 200);
            doc.setLineWidth(0.8);
            dataPoints.push(dataPoints[0]);
            for(let i=0; i<5; i++) doc.line(dataPoints[i][0], dataPoints[i][1], dataPoints[i+1][0], dataPoints[i+1][1]);
        }

        // Move Y past the tallest element (usually image or specs)
        currentY = Math.max(startRowY + col1W, specY) + 10;

        // --- Compact Notes ---
        const printNoteSection = (label: string, text?: string) => {
            if (!text) return;
            
            checkPageBreak(15);
            
            // Layout: Label (Bold) on left, Text block on right
            const labelWidth = 22;
            const textWidth = contentWidth - labelWidth;

            doc.setFontSize(9); // Compact font size
            
            // Label
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0);
            doc.text(label, margin, currentY);

            // Text
            doc.setFont("helvetica", "normal");
            doc.setTextColor(40);
            const textLines = doc.splitTextToSize(text, textWidth);
            doc.text(textLines, margin + labelWidth, currentY);

            currentY += (textLines.length * 4.5) + 3; // Tight spacing
        };

        printNoteSection("Visual:", tasting.visual);
        printNoteSection("Aroma:", tasting.aroma);
        printNoteSection("Gusto:", tasting.taste);
        
        // Notes / Conclusions (Bold Header)
        if (tasting.notes) {
            currentY += 2;
            checkPageBreak(20);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(0);
            doc.text("Conclusiones & Notas", margin, currentY);
            currentY += 5;
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(40);
            const lines = doc.splitTextToSize(tasting.notes, contentWidth);
            doc.text(lines, margin, currentY);
            currentY += (lines.length * 4.5);
        }

        // Tags
        if (tasting.tags.length > 0) {
            currentY += 5;
            checkPageBreak(10);
            doc.setFontSize(8);
            doc.setTextColor(100);
            const tagsStr = tasting.tags.map(t => `#${t}`).join("  ");
            doc.text(tagsStr, margin, currentY);
        }

        // Footer
        doc.setFontSize(7);
        doc.setTextColor(180);
        doc.text("Generado con KataList App", pageWidth / 2, pageHeight - 8, { align: 'center' });

        doc.save(`${tasting.name.replace(/\s+/g, '_')}_Ficha.pdf`);
    } catch (e) {
        console.error("PDF Generation Critical Failure", e);
        throw new Error("No se pudo cargar el motor PDF. Revisa tu conexión.");
    }
};
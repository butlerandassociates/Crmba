import { useRef } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { FileDown } from "lucide-react";

import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

interface ForemanPaymentBreakdownProps {
  project: any;
}

export function ForemanPaymentBreakdown({ project }: ForemanPaymentBreakdownProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatUnit = (unit: string) => {
    const unitMap: Record<string, string> = {
      sq_ft: "sq ft",
      linear_ft: "linear ft",
      each: "ea",
      hour: "hr",
    };
    return unitMap[unit] || unit;
  };

  const exportToPDF = async () => {
    if (!contentRef.current) return;

    try {
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;

      pdf.addImage(
        imgData,
        "PNG",
        imgX,
        imgY,
        imgWidth * ratio,
        imgHeight * ratio
      );
      pdf.save(`foreman-payment-${project.name.replace(/\s+/g, "-")}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  if (!project.lineItems || project.lineItems.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-sm">
            No labor items available for this project.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalLabor = project.lineItems.reduce((sum, item) => sum + item.totalLabor, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Crew Foreman Payment Breakdown</h3>
        <Button onClick={exportToPDF} variant="outline" size="sm">
          <FileDown className="h-4 w-4 mr-2" />
          Export PDF
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div ref={contentRef} className="bg-white p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-gray-900">
              {/* Left: Foreman Info */}
              <div>
                <h2 className="text-lg font-bold mb-1">Crew Foreman</h2>
                <div className="text-sm space-y-0.5">
                  <div className="font-semibold">{project.foremanName}</div>
                  <div className="text-gray-600">{project.foremanPhone || "N/A"}</div>
                </div>
              </div>

              {/* Right: Job Info */}
              <div className="text-right">
                <h2 className="text-lg font-bold mb-1">Job Assignment</h2>
                <div className="text-sm space-y-0.5">
                  <div className="font-semibold">{project.clientName}</div>
                  <div className="text-gray-600">{project.clientAddress || "N/A"}</div>
                  <div className="text-gray-600 mt-1">
                    <span className="font-medium">Start:</span> {formatDate(project.startDate)}
                  </div>
                  {project.endDate && (
                    <div className="text-gray-600">
                      <span className="font-medium">End:</span> {formatDate(project.endDate)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Labor Items Table */}
            <div className="mb-6">
              <h3 className="text-base font-bold mb-3">Scope of Work & Payment Details</h3>
              
              {/* Table Header */}
              <div className="grid grid-cols-[2fr,0.8fr,0.6fr,0.8fr,1fr] gap-2 bg-gray-100 px-3 py-2 rounded-t-lg font-semibold text-xs border-b-2 border-gray-300">
                <div>Scope of Work</div>
                <div className="text-right">Quantity</div>
                <div className="text-right">Unit</div>
                <div className="text-right">$/Unit</div>
                <div className="text-right">Total</div>
              </div>

              {/* Table Rows */}
              <div className="border-x-2 border-b-2 border-gray-300 rounded-b-lg">
                {project.lineItems.map((item, index) => (
                  <div
                    key={item.id}
                    className={`grid grid-cols-[2fr,0.8fr,0.6fr,0.8fr,1fr] gap-2 px-3 py-2 text-xs ${
                      index % 2 === 0 ? "bg-white" : "bg-gray-50"
                    } ${index !== project.lineItems!.length - 1 ? "border-b border-gray-200" : ""}`}
                  >
                    <div className="font-medium">{item.productName}</div>
                    <div className="text-right">{item.quantity.toLocaleString()}</div>
                    <div className="text-right">{formatUnit(item.unit)}</div>
                    <div className="text-right">{formatCurrency(item.laborCostPerUnit)}</div>
                    <div className="text-right font-semibold">{formatCurrency(item.totalLabor)}</div>
                  </div>
                ))}

                {/* Total Row */}
                <div className="grid grid-cols-[2fr,0.8fr,0.6fr,0.8fr,1fr] gap-2 px-3 py-3 bg-gray-900 text-white font-bold text-xs rounded-b-lg">
                  <div className="col-span-4 text-right">TOTAL LABOR PAYMENT:</div>
                  <div className="text-right text-sm">{formatCurrency(totalLabor)}</div>
                </div>
              </div>
            </div>

            {/* Signature Section */}
            <div className="grid grid-cols-2 gap-6 mt-8 pt-6 border-t-2 border-gray-300">
              <div>
                <div className="font-semibold mb-2 text-sm">Butler & Associates Construction, Inc.</div>
                <div className="border-b-2 border-gray-900 h-12 mb-2"></div>
                <div className="text-xs text-gray-600">
                  <div>Signature</div>
                  <div className="mt-1">Date: _______________</div>
                </div>
              </div>
              <div>
                <div className="font-semibold mb-2 text-sm">Crew Foreman</div>
                <div className="border-b-2 border-gray-900 h-12 mb-2"></div>
                <div className="text-xs text-gray-600">
                  <div>Signature</div>
                  <div className="mt-1">Date: _______________</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
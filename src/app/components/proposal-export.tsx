import { Proposal, Client } from "../data/mock-data";

interface ProposalExportProps {
  proposal: Proposal;
  client: Client;
}

export function ProposalExport({ proposal, client }: ProposalExportProps) {
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

  return (
    <div className="bg-white text-black p-8 space-y-8">
      {/* Header - Branding Section */}
      <div className="border-b-4 border-primary pb-6">
        <div className="flex items-start justify-between">
          <div>
            {/* Company Logo Placeholder */}
            <div className="h-16 w-48 bg-gradient-to-r from-primary to-primary/80 rounded flex items-center justify-center mb-4">
              <h1 className="text-white font-bold text-xl">BUTLER & ASSOCIATES</h1>
            </div>
            <p className="text-sm text-gray-600">Construction, Inc.</p>
            <p className="text-xs text-gray-500 mt-2">
              Licensed • Bonded • Insured
            </p>
          </div>
          
          <div className="text-right text-sm">
            <p className="font-semibold">Contact Information</p>
            <p className="text-gray-600">(555) 123-4567</p>
            <p className="text-gray-600">info@butlerassociates.com</p>
            <p className="text-gray-600 mt-2">
              123 Construction Way<br />
              Suite 100<br />
              Your City, ST 12345
            </p>
          </div>
        </div>
      </div>

      {/* Proposal Header */}
      <div>
        <h2 className="text-3xl font-bold text-primary mb-2">PROJECT PROPOSAL</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500 text-xs uppercase font-medium mb-1">Prepared For</p>
            <p className="font-semibold">{client.name}</p>
            <p className="text-gray-600">{client.company}</p>
            <p className="text-gray-600">{client.email}</p>
            <p className="text-gray-600">{client.phone}</p>
            <p className="text-gray-600 mt-1">{client.address}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase font-medium mb-1">Proposal Details</p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600">Date:</span>
                <span className="font-medium">{formatDate(proposal.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Valid Until:</span>
                <span className="font-medium">{formatDate(proposal.validUntil)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Prepared By:</span>
                <span className="font-medium">{proposal.createdBy}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Project Overview */}
      <div>
        <h3 className="text-xl font-bold border-b-2 border-gray-200 pb-2 mb-3">
          {proposal.title}
        </h3>
        <p className="text-gray-700 leading-relaxed">{proposal.description}</p>
      </div>

      {/* Scope of Work */}
      <div>
        <h3 className="text-xl font-bold border-b-2 border-gray-200 pb-2 mb-4">
          Scope of Work
        </h3>
        
        <table className="w-full">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-left p-3 text-sm font-semibold">Description</th>
              <th className="text-center p-3 text-sm font-semibold w-24">Qty</th>
              <th className="text-center p-3 text-sm font-semibold w-24">Unit</th>
              <th className="text-right p-3 text-sm font-semibold w-32">Rate</th>
              <th className="text-right p-3 text-sm font-semibold w-32">Amount</th>
            </tr>
          </thead>
          <tbody>
            {proposal.lineItems.map((item, index) => (
              <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="p-3 text-sm">{item.productName}</td>
                <td className="p-3 text-sm text-center">{item.quantity.toLocaleString()}</td>
                <td className="p-3 text-sm text-center">{item.unit}</td>
                <td className="p-3 text-sm text-right">{formatCurrency(item.pricePerUnit)}</td>
                <td className="p-3 text-sm text-right font-semibold">
                  {formatCurrency(item.totalPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-80 space-y-2">
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-semibold">{formatCurrency(proposal.subtotal)}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">Tax</span>
            <span className="font-semibold">{formatCurrency(proposal.tax)}</span>
          </div>
          <div className="flex justify-between py-3 border-t-2 border-primary">
            <span className="text-lg font-bold">Total Investment</span>
            <span className="text-xl font-bold text-primary">
              {formatCurrency(proposal.total)}
            </span>
          </div>
        </div>
      </div>

      {/* Terms & Conditions */}
      <div className="border-t-2 border-gray-200 pt-6 space-y-4">
        <div>
          <h3 className="text-lg font-bold mb-3">Payment Terms</h3>
          <ul className="text-sm text-gray-700 space-y-2 list-disc list-inside">
            <li>50% deposit required upon acceptance of proposal</li>
            <li>25% due at project midpoint</li>
            <li>25% due upon project completion</li>
            <li>Payment accepted via check, ACH, or credit card</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-bold mb-3">Project Timeline</h3>
          <p className="text-sm text-gray-700">
            Work will commence within 2 weeks of signed agreement and deposit receipt. 
            Estimated completion time will be discussed during project kickoff meeting.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-bold mb-3">Terms & Conditions</h3>
          <ul className="text-sm text-gray-700 space-y-2 list-disc list-inside">
            <li>This proposal is valid for 30 days from the date above</li>
            <li>All work performed according to local building codes and regulations</li>
            <li>Change orders may affect final price and timeline</li>
            <li>1-year warranty on all workmanship</li>
            <li>Client responsible for obtaining necessary permits unless otherwise stated</li>
            <li>Final payment due upon completion and client approval</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-bold mb-3">What's Included</h3>
          <ul className="text-sm text-gray-700 space-y-2 list-disc list-inside">
            <li>All materials and labor as specified in scope of work</li>
            <li>Professional project management throughout the project</li>
            <li>Site cleanup upon completion</li>
            <li>Licensed and insured contractors</li>
            <li>Quality assurance and final inspection</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-bold mb-3">Exclusions</h3>
          <ul className="text-sm text-gray-700 space-y-2 list-disc list-inside">
            <li>Permit fees (unless specifically included in proposal)</li>
            <li>Work not explicitly mentioned in scope of work section</li>
            <li>Repairs to underground utilities</li>
            <li>Landscaping restoration beyond immediate work area</li>
          </ul>
        </div>
      </div>

      {/* Acceptance Section */}
      <div className="border-2 border-primary rounded-lg p-6 mt-8 bg-gray-50">
        <h3 className="text-lg font-bold mb-4">Proposal Acceptance</h3>
        <p className="text-sm text-gray-700 mb-6">
          By signing below, you authorize Butler & Associates Construction, Inc. to proceed with the 
          work outlined in this proposal under the terms and conditions stated above.
        </p>
        
        <div className="grid grid-cols-2 gap-8">
          <div>
            <div className="border-b-2 border-gray-400 mb-2 pb-8"></div>
            <p className="text-sm font-semibold">Client Signature</p>
            <p className="text-xs text-gray-500">Date: _______________</p>
          </div>
          <div>
            <div className="border-b-2 border-gray-400 mb-2 pb-8"></div>
            <p className="text-sm font-semibold">Butler & Associates Representative</p>
            <p className="text-xs text-gray-500">Date: _______________</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t pt-6 text-center text-xs text-gray-500">
        <p>Thank you for considering Butler & Associates Construction, Inc. for your project.</p>
        <p className="mt-2">
          Questions? Contact us at (555) 123-4567 or info@butlerassociates.com
        </p>
        <p className="mt-4 font-semibold">
          License #123456 | Bonded & Insured | Serving the Community Since 2010
        </p>
      </div>
    </div>
  );
}

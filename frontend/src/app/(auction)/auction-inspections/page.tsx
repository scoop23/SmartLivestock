"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClipboardCheck, Plus, X, Trash2, Eye } from "lucide-react";
import { Sidebar } from "@/app/components/sidebar";
import { PageHeader } from "@/app/components/page-header";
import MobileNavAuction from "@/app/components/mobilenavauction";

interface InspectionItem {
  livestock_type: string;
  quantity: string;
  sex: string;
  classification: string;
  remarks: string;
}

interface InspectionFormData {
  shipper_name: string;
  destination: string;
  purpose: string;
  inspection_date: string;
  items: InspectionItem[];
  control_number: string;
  date_issued: string;
  time_issued: string;
  shipper_address: string;
  origin: string;
  vehicle_plate_number: string;
  livestock_handler_license_no: string;
  status: string;
}

const initialItem: InspectionItem = {
  livestock_type: "",
  quantity: "",
  sex: "MIXED",
  classification: "SLAUGHTER",
  remarks: "",
};

const initialFormData: InspectionFormData = {
  shipper_name: "",
  destination: "",
  purpose: "SLAUGHTER",
  inspection_date: "",
  items: [{ ...initialItem }],
  control_number: "",
  date_issued: "",
  time_issued: "",
  shipper_address: "",
  origin: "Padre Garcia, Batangas",
  vehicle_plate_number: "",
  livestock_handler_license_no: "",
  status: "PENDING",
};

export default function AuctionInspections() {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState<number | null>(null);
  const [formData, setFormData] = useState<InspectionFormData>(initialFormData);

  const inspections = [
    { id: 1, shipper_name: "Juan Dela Cruz", destination: "Batangas City Slaughterhouse", purpose: "SLAUGHTER", inspection_date: "2026-04-25", control_number: "CLR-2026-0001", status: "PENDING", items: [
      { livestock_type: "Cattle", quantity: 5, sex: "MALE", classification: "SLAUGHTER", remarks: "Healthy stock" },
      { livestock_type: "Carabao", quantity: 2, sex: "FEMALE", classification: "BREEDER", remarks: "" },
    ]},
    { id: 2, shipper_name: "Maria Santos", destination: "Lipa Breeding Center", purpose: "BREEDING", inspection_date: "2026-04-24", control_number: "CLR-2026-0002", status: "VERIFIED", items: [
      { livestock_type: "Cattle", quantity: 3, sex: "FEMALE", classification: "BREEDER", remarks: "For breeding program" },
    ]},
    { id: 3, shipper_name: "Pedro Reyes", destination: "Tanauan Fattening Yard", purpose: "FATTENING", inspection_date: "2026-04-24", control_number: "CLR-2026-0003", status: "APPROVED", items: [
      { livestock_type: "Cattle", quantity: 8, sex: "MIXED", classification: "FATTENING", remarks: "" },
    ]},
    { id: 4, shipper_name: "Rosa Garcia", destination: "Batangas City Slaughterhouse", purpose: "SLAUGHTER", inspection_date: "2026-04-23", control_number: "CLR-2026-0004", status: "REJECTED", items: [
      { livestock_type: "Goat", quantity: 10, sex: "MIXED", classification: "SLAUGHTER", remarks: "Missing health certificate" },
    ]},
  ];

  const statusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-yellow-100 text-yellow-700";
      case "VERIFIED": return "bg-blue-100 text-blue-700";
      case "APPROVED": return "bg-green-100 text-green-700";
      case "REJECTED": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const updateItem = (index: number, field: keyof InspectionItem, value: string) => {
    const updated = [...formData.items];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, items: updated });
  };

  const addItem = () => {
    setFormData({ ...formData, items: [...formData.items, { ...initialItem }] });
  };

  const removeItem = (index: number) => {
    if (formData.items.length <= 1) return;
    setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitted inspection:", formData);
    setShowForm(false);
    setFormData(initialFormData);
  };

  const selectedInspection = showDetail !== null ? inspections.find(i => i.id === showDetail) : null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="hidden md:block">
        <Sidebar role="auction" onLogout={() => router.push("/")} />
      </div>
      <main className="flex flex-col w-full">
        <PageHeader
          title="Livestock Inspections"
          subtitle="Manage inspection records and clearances"
          variant="auction"
          sticky
          mobileMenuOffset={false}
          action={
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-white text-[#7C3AED] px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-100 transition-colors"
            >
              <Plus className="w-4 h-4" /> New Inspection
            </button>
          }
        />

        <div className="px-6 py-6 space-y-6">
          {/* Inspections Table */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">All Inspections</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-300 bg-gray-50">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Control #</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Shipper</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Destination</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Purpose</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inspections.map((record) => (
                    <tr key={record.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 font-medium text-gray-900">{record.control_number}</td>
                      <td className="py-3 px-4 text-gray-700">{record.shipper_name}</td>
                      <td className="py-3 px-4 text-gray-700">{record.destination}</td>
                      <td className="py-3 px-4 text-gray-700">{record.purpose}</td>
                      <td className="py-3 px-4 text-gray-700">{record.inspection_date}</td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor(record.status)}`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => setShowDetail(record.id)}
                          className="text-[#7C3AED] hover:underline text-sm font-semibold flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
      <MobileNavAuction />

      {/* New Inspection Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#7C3AED] text-white p-6 rounded-t-2xl flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">New Livestock Inspection</h2>
                <p className="text-sm text-white/75">Fill in the inspection and clearance details</p>
              </div>
              <button onClick={() => { setShowForm(false); setFormData(initialFormData); }} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Inspection Details */}
              <div>
                <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide mb-3">Inspection Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Shipper Name</label>
                    <input type="text" placeholder="e.g. Juan Dela Cruz" value={formData.shipper_name} onChange={e => setFormData({ ...formData, shipper_name: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#7C3AED] text-sm" required />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Destination</label>
                    <input type="text" placeholder="e.g. Batangas City Slaughterhouse" value={formData.destination} onChange={e => setFormData({ ...formData, destination: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#7C3AED] text-sm" required />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Purpose</label>
                    <select value={formData.purpose} onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#7C3AED] text-sm" required>
                      <option value="BREEDING">Breeding</option>
                      <option value="FATTENING">Fattening</option>
                      <option value="SLAUGHTER">Slaughter</option>
                      <option value="UNKNOWN">Unknown</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Inspection Date</label>
                    <input type="date" value={formData.inspection_date} onChange={e => setFormData({ ...formData, inspection_date: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#7C3AED] text-sm" required />
                  </div>
                </div>
              </div>

              {/* Inspection Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Livestock Items</h3>
                  <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs font-bold text-[#7C3AED] hover:underline">
                    <Plus className="w-3 h-3" /> Add Item
                  </button>
                </div>
                <div className="space-y-4">
                  {formData.items.map((item, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500">Item #{index + 1}</span>
                        {formData.items.length > 1 && (
                          <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Livestock Type</label>
                          <input type="text" placeholder="e.g. Cattle" value={item.livestock_type} onChange={e => updateItem(index, 'livestock_type', e.target.value)}
                            className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#7C3AED] text-sm" required />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Quantity</label>
                          <input type="number" min="1" placeholder="1" value={item.quantity} onChange={e => updateItem(index, 'quantity', e.target.value)}
                            className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#7C3AED] text-sm" required />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Sex</label>
                          <select value={item.sex} onChange={e => updateItem(index, 'sex', e.target.value)}
                            className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#7C3AED] text-sm">
                            <option value="MALE">Male</option>
                            <option value="FEMALE">Female</option>
                            <option value="MIXED">Mixed</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Classification</label>
                          <select value={item.classification} onChange={e => updateItem(index, 'classification', e.target.value)}
                            className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#7C3AED] text-sm">
                            <option value="BREEDER">Breeder</option>
                            <option value="SLAUGHTER">Slaughter</option>
                            <option value="FATTENING">Fattening</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Remarks</label>
                        <input type="text" placeholder="Optional remarks" value={item.remarks} onChange={e => updateItem(index, 'remarks', e.target.value)}
                          className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#7C3AED] text-sm" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Clearance Details */}
              <div>
                <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide mb-3">Clearance Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Control Number</label>
                    <input type="text" placeholder="e.g. CLR-2026-0001" value={formData.control_number} onChange={e => setFormData({ ...formData, control_number: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#7C3AED] text-sm" required />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Status</label>
                    <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#7C3AED] text-sm">
                      <option value="PENDING">Pending</option>
                      <option value="VERIFIED">Verified</option>
                      <option value="APPROVED">Approved</option>
                      <option value="REJECTED">Rejected</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Date Issued</label>
                    <input type="date" value={formData.date_issued} onChange={e => setFormData({ ...formData, date_issued: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#7C3AED] text-sm" required />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Time Issued</label>
                    <input type="time" value={formData.time_issued} onChange={e => setFormData({ ...formData, time_issued: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#7C3AED] text-sm" required />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Shipper Address</label>
                    <input type="text" placeholder="Full address" value={formData.shipper_address} onChange={e => setFormData({ ...formData, shipper_address: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#7C3AED] text-sm" required />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Origin</label>
                    <input type="text" value={formData.origin} onChange={e => setFormData({ ...formData, origin: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#7C3AED] text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Vehicle Plate Number</label>
                    <input type="text" placeholder="Optional" value={formData.vehicle_plate_number} onChange={e => setFormData({ ...formData, vehicle_plate_number: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#7C3AED] text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Handler License No.</label>
                    <input type="text" placeholder="Optional" value={formData.livestock_handler_license_no} onChange={e => setFormData({ ...formData, livestock_handler_license_no: e.target.value })}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#7C3AED] text-sm" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setFormData(initialFormData); }}
                  className="flex-1 border border-gray-200 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-[2] bg-[#7C3AED] text-white py-3 rounded-xl font-bold shadow-lg hover:bg-[#6D28D9] transition-colors">
                  Submit Inspection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedInspection && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="bg-[#7C3AED] text-white p-6 rounded-t-2xl flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Inspection Details</h2>
                <p className="text-sm text-white/75">{selectedInspection.control_number}</p>
              </div>
              <button onClick={() => setShowDetail(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Shipper</p>
                  <p className="text-sm font-medium text-gray-900">{selectedInspection.shipper_name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Destination</p>
                  <p className="text-sm font-medium text-gray-900">{selectedInspection.destination}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Purpose</p>
                  <p className="text-sm font-medium text-gray-900">{selectedInspection.purpose}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Date</p>
                  <p className="text-sm font-medium text-gray-900">{selectedInspection.inspection_date}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor(selectedInspection.status)}`}>
                    {selectedInspection.status}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Livestock Items</p>
                <div className="space-y-2">
                  {selectedInspection.items.map((item, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-900">{item.livestock_type}</span>
                        <span className="text-xs text-gray-500">x{item.quantity}</span>
                      </div>
                      <div className="flex gap-3 mt-1">
                        <span className="text-[10px] text-gray-500">{item.sex}</span>
                        <span className="text-[10px] text-gray-500">{item.classification}</span>
                        {item.remarks && <span className="text-[10px] text-gray-400 italic">{item.remarks}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={() => setShowDetail(null)}
                className="w-full border border-gray-200 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

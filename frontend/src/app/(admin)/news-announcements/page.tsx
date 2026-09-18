"use client";

import { useState } from 'react';
import { PageHeader } from '@/app/components/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Megaphone,
  Plus,
  Search,
  Trash2,
  Edit3,
  Eye,
  Calendar,
  Tag,
  Globe,
  Lock,
  MoreVertical,
  ImageIcon,
  User,
  X,
  FileText,
  Inbox
} from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  thumbnail?: string;
  category: 'Health Alert' | 'Event' | 'System' | 'General';
  status: 'Published' | 'Draft' | 'Scheduled';
  author: string;
  date: string;
  target: 'All Farmers' | 'Staff Only' | 'Public';
}

export default function NewsAnnouncementsPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  // State to filter the list
  const [activeTab, setActiveTab] = useState<'all' | 'drafts'>('all');

  // Mock Data
  const announcements: Announcement[] = [
    { id: 'ANN-001', title: 'Mandatory FMD Vaccination Drive', category: 'Health Alert', status: 'Published', author: 'Admin Sarah', date: '2026-04-20', target: 'All Farmers', thumbnail: 'https://images.unsplash.com/photo-1545468843-27289b0485fd?q=80&w=100&h=100&auto=format&fit=crop' },
    { id: 'ANN-002', title: 'Padre Garcia Cattle Auction 2026', category: 'Event', status: 'Scheduled', author: 'Juan Admin', date: '2026-05-15', target: 'Public' },
    { id: 'ANN-003', title: 'System Maintenance: Sunday Midnight', category: 'System', status: 'Draft', author: 'IT Support', date: '2026-04-28', target: 'All Farmers' },
  ];

  // Logic to filter based on button selection
  const filteredAnnouncements = activeTab === 'all'
    ? announcements
    : announcements.filter(item => item.status === 'Draft');

  return (
    <>
      <PageHeader
        title="News & Announcements"
        subtitle="Manage public bulletins and community alerts — Municipal Agriculture Office"
        icon={<Megaphone className="h-6 w-6" />}
        variant="admin"
        maxWidthClass="w-full"
        mobileMenuOffset={false}
        action={
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-[#2D5A27] px-3.5 h-8.5 font-bold text-white text-xs shadow-xs transition-all hover:bg-[#23461f] active:scale-95 cursor-pointer"
          >
            {isCreating ? <><X className="h-3.5 w-3.5" /> Cancel</> : <><Plus className="h-3.5 w-3.5" /> New Announcement</>}
          </button>
        }
      />

      <div className="p-3 sm:p-4 md:p-5 w-full space-y-3.5">

          {/* Create Section */}
          {isCreating && (
            <section className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="bg-gray-50 px-3.5 py-2.5 border-b border-gray-100">
                <h3 className="font-bold text-gray-800 text-xs flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-[#2D5A27]" />
                  Drafting New Content
                </h3>
              </div>

              <div className="p-3.5 sm:p-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Left: Metadata & Thumbnail */}
                <div className="lg:col-span-1 space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Thumbnail Image</label>
                    <div className="relative group aspect-video bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center overflow-hidden hover:border-[#2D5A27] transition-colors cursor-pointer">
                      {previewImage ? (
                        <>
                          <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                          <button onClick={() => setPreviewImage(null)} className="absolute top-1.5 right-1.5 p-1 bg-black/50 rounded-full text-white hover:bg-black"><X className="w-3.5 h-3.5" /></button>
                        </>
                      ) : (
                        <>
                          <ImageIcon className="w-6 h-6 text-gray-400 group-hover:text-[#2D5A27] mb-1" />
                          <span className="text-[10px] font-bold text-gray-500">Upload Photo</span>
                          <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setPreviewImage(URL.createObjectURL(e.target.files![0]))} />
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Author Name</label>
                    <div className="relative">
                      <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                      <input type="text" placeholder="Admin Name" className="w-full pl-8 pr-3 h-8.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#2D5A27] outline-none" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Publish Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                      <input type="date" className="w-full pl-8 pr-3 h-8.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#2D5A27] outline-none" />
                    </div>
                  </div>
                </div>

                {/* Right: Main Content */}
                <div className="lg:col-span-3 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Announcement Title</label>
                      <input type="text" placeholder="Enter a catchy headline..." className="w-full h-8.5 px-3 bg-gray-50 border border-gray-200 rounded-lg font-bold text-xs text-gray-800 focus:ring-2 focus:ring-[#2D5A27] outline-none" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Category</label>
                      <select className="w-full h-8.5 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#2D5A27]">
                        <option>Health Alert</option>
                        <option>Event</option>
                        <option>System Update</option>
                        <option>General News</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Visibility</label>
                      <select className="w-full h-8.5 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#2D5A27]">
                        <option>All Farmers</option>
                        <option>Public</option>
                        <option>Staff Only</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Bulletin Message</label>
                    <textarea rows={4} placeholder="Write the full details here..." className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#2D5A27] outline-none resize-none"></textarea>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button className="px-4 h-8.5 rounded-lg font-bold text-xs text-gray-500 hover:bg-gray-100 transition-all cursor-pointer">Save as Draft</button>
                    <button className="px-5 h-8.5 bg-[#2D5A27] text-white rounded-lg text-xs font-bold hover:shadow-xs hover:bg-[#1e3d1a] transition-all cursor-pointer">Publish Post</button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Tab Selection Section */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex bg-white p-0.5 rounded-lg border border-gray-200 shadow-2xs">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'all' ? 'bg-[#2D5A27] text-white shadow-2xs' : 'text-gray-500 hover:bg-gray-50'
                  }`}
              >
                <FileText className="w-3.5 h-3.5" />
                All Announcements
              </button>
              <button
                onClick={() => setActiveTab('drafts')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${activeTab === 'drafts' ? 'bg-[#2D5A27] text-white shadow-2xs' : 'text-gray-500 hover:bg-gray-50'
                  }`}
              >
                <Inbox className="w-3.5 h-3.5" />
                Drafts
              </button>
            </div>

            <div className="relative md:w-72 w-full">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
              <input type="text" placeholder="Search title or author..." className="w-full pl-8 pr-3 h-8.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#2D5A27] outline-none shadow-2xs" />
            </div>
          </div>

          {/* List Section */}
          <section className="bg-white rounded-xl shadow-2xs border border-gray-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-100 bg-gray-50/50 hover:bg-gray-50/50">
                  <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-gray-400 uppercase tracking-widest">Cover & Title</TableHead>
                  <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-gray-400 uppercase tracking-widest">Details</TableHead>
                  <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-gray-400 uppercase tracking-widest">Status</TableHead>
                  <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-gray-400 uppercase tracking-widest text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-50">
                {filteredAnnouncements.length > 0 ? (
                  filteredAnnouncements.map((item) => (
                    <TableRow key={item.id} className="group hover:bg-gray-50/80 transition-all border-none">
                      <TableCell className="px-3.5 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden shrink-0 shadow-2xs">
                            {item.thumbnail ? (
                              <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon className="w-4 h-4" /></div>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-gray-800 line-clamp-1 group-hover:text-[#2D5A27] transition-colors">{item.title}</div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5 flex items-center gap-1">
                              <Tag className="w-3 h-3 text-gray-400" /> {item.category}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5">
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                            <User className="w-3 h-3 text-[#2D5A27]" /> {item.author}
                          </div>
                          <div className="text-[10px] text-gray-400 font-medium flex items-center gap-1.5">
                            <Calendar className="w-3 h-3" /> {item.date}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5">
                        <Badge
                          variant="outline"
                          className={`border-none text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                            item.status === 'Published' ? 'bg-green-100 text-green-700' :
                            item.status === 'Scheduled' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3.5 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#2D5A27] transition-all cursor-pointer" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
                          <button className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-all cursor-pointer" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="px-3.5 py-8 text-center text-gray-400 text-xs italic">
                      No {activeTab} found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </section>
        </div>
    </>
  );
}

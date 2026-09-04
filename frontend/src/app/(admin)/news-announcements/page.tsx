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
          maxWidthClass="max-w-6xl"
          mobileMenuOffset={false}
          action={
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#2D5A27] px-5 py-2.5 font-bold text-white text-xs shadow-md transition-all hover:bg-[#23461f] active:scale-95 cursor-pointer"
            >
              {isCreating ? <><X className="h-4 w-4" /> Cancel</> : <><Plus className="h-4 w-4" /> New Announcement</>}
            </button>
          }
        />

        <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">

          {/* Create Section */}
          {isCreating && (
            <section className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in duration-300">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-[#2D5A27]" />
                  Drafting New Content
                </h3>
              </div>

              <div className="p-6 grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Left: Metadata & Thumbnail */}
                <div className="lg:col-span-1 space-y-5">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Thumbnail Image</label>
                    <div className="relative group aspect-video bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center overflow-hidden hover:border-[#2D5A27] transition-colors cursor-pointer">
                      {previewImage ? (
                        <>
                          <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                          <button onClick={() => setPreviewImage(null)} className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black"><X className="w-4 h-4" /></button>
                        </>
                      ) : (
                        <>
                          <ImageIcon className="w-8 h-8 text-gray-400 group-hover:text-[#2D5A27] mb-2" />
                          <span className="text-[10px] font-bold text-gray-500">Upload Photo</span>
                          <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setPreviewImage(URL.createObjectURL(e.target.files![0]))} />
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Author Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <input type="text" placeholder="Admin Name" className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2D5A27] outline-none" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Publish Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <input type="date" className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2D5A27] outline-none" />
                    </div>
                  </div>
                </div>

                {/* Right: Main Content */}
                <div className="lg:col-span-3 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Announcement Title</label>
                      <input type="text" placeholder="Enter a catchy headline..." className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg font-bold text-gray-800 focus:ring-2 focus:ring-[#2D5A27] outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Category</label>
                      <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#2D5A27]">
                        <option>Health Alert</option>
                        <option>Event</option>
                        <option>System Update</option>
                        <option>General News</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Visibility</label>
                      <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#2D5A27]">
                        <option>All Farmers</option>
                        <option>Public</option>
                        <option>Staff Only</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Bulletin Message</label>
                    <textarea rows={5} placeholder="Write the full details here..." className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2D5A27] outline-none resize-none"></textarea>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button className="px-6 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all">Save as Draft</button>
                    <button className="px-8 py-2.5 bg-[#2D5A27] text-white rounded-xl font-bold hover:shadow-lg hover:bg-[#1e3d1a] transition-all">Publish Post</button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Tab Selection Section */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-6 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${activeTab === 'all' ? 'bg-[#2D5A27] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                  }`}
              >
                <FileText className="w-4 h-4" />
                All Announcements
              </button>
              <button
                onClick={() => setActiveTab('drafts')}
                className={`px-6 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${activeTab === 'drafts' ? 'bg-[#2D5A27] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                  }`}
              >
                <Inbox className="w-4 h-4" />
                Drafts
              </button>
            </div>

            <div className="relative md:w-80 w-full">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search title or author..." className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2D5A27] outline-none shadow-sm" />
            </div>
          </div>

          {/* List Section */}
          <section className="bg-white rounded-2xl md:rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-100 bg-gray-50/50 hover:bg-gray-50/50">
                  <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Cover & Title</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Details</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-50">
                {filteredAnnouncements.length > 0 ? (
                  filteredAnnouncements.map((item) => (
                    <TableRow key={item.id} className="group hover:bg-gray-50/80 transition-all border-none">
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden shrink-0 shadow-xs">
                            {item.thumbnail ? (
                              <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon className="w-5 h-5" /></div>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-gray-800 line-clamp-1 group-hover:text-[#2D5A27] transition-colors">{item.title}</div>
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider mt-1 flex items-center gap-1">
                              <Tag className="w-3 h-3 text-gray-400" /> {item.category}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-[#2D5A27]" /> {item.author}
                          </div>
                          <div className="text-[10px] text-gray-400 font-medium flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" /> {item.date}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Badge
                          variant="outline"
                          className={`border-none text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                            item.status === 'Published' ? 'bg-green-100 text-green-700' :
                            item.status === 'Scheduled' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-[#2D5A27] transition-all" title="Edit"><Edit3 className="w-4 h-4" /></button>
                          <button className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-all" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="px-6 py-12 text-center text-gray-400 text-sm italic">
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

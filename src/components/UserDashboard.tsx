/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile, Bill, PaymentWithDetails, PaymentStatus, Payment } from '../types';
import { 
  LogOut, CreditCard, Eye, Camera, CheckCircle2, AlertCircle, Clock, 
  HelpCircle, ChevronUp, ChevronDown, RefreshCw, FileText, Download, X,
  ShieldAlert, ArrowLeftRight, Edit2, ImageIcon, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserDashboardProps {
  currentProfile: UserProfile;
  onLogout: () => void;
  isSwitched?: boolean;
  onToggleAccount: () => void;
}

export default function UserDashboard({ currentProfile, onLogout, isSwitched, onToggleAccount }: UserDashboardProps) {
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Expanded payment state to manage collapsible cards
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(null);
  
  // Modal viewers
  const [viewingDocument, setViewingDocument] = useState<string | null>(null);
  const [selectedPaymentForReview, setSelectedPaymentForReview] = useState<Payment | null>(null);

  const handleUpdatePaymentStatus = async (paymentId: string, nextStatus: PaymentStatus) => {
    setActionLoading(`status_${paymentId}`);
    try {
      const { error: updateErr } = await supabase
        .from('payments')
        .update({ status: nextStatus })
        .eq('id', paymentId);

      if (updateErr) throw updateErr;

      setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, status: nextStatus } : p));
      if (selectedPaymentForReview && selectedPaymentForReview.id === paymentId) {
        setSelectedPaymentForReview({ ...selectedPaymentForReview, status: nextStatus });
      }
      setSuccessMsg(`Status updated to ${nextStatus}`);
      setTimeout(() => setSuccessMsg(null), 2000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  // Load user assigned payments and related bills
  const loadUserPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch payments belonging to this user
      const { data: paymentsData, error: paymentsErr } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', currentProfile.id);
      if (paymentsErr) throw paymentsErr;

      // 2. Fetch bills to display categories and dates
      const { data: billsData, error: billsErr } = await supabase
        .from('bills')
        .select('*');
      if (billsErr) throw billsErr;

      setBills(billsData || []);
      
      // Inject bill details into payments
      const detailedPayments = (paymentsData || []).map((pay: any) => {
        const associatedBill = (billsData || []).find((b: any) => b.id === pay.bill_id);
        return {
          ...pay,
          bill: associatedBill,
        };
      });

      // Sort with unpaid first, then month descending
      detailedPayments.sort((a, b) => {
        if (a.status === 'Unpaid' && b.status !== 'Unpaid') return -1;
        if (a.status !== 'Unpaid' && b.status === 'Unpaid') return 1;
        const monthA = a.bill?.billing_month || '';
        const monthB = b.bill?.billing_month || '';
        return monthB.localeCompare(monthA);
      });

      setPayments(detailedPayments);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load assigned payments. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. 先安全加载初始数据
    try {
      loadDashboardData();
    } catch (e) {
      console.error("加载初始数据失败:", e);
    }

    // 2. 安全初始化 Realtime 监听
    let channel: any = null;
    
    try {
      // ⚠️ 如果你顶部引入的是 realSupabase，请把这里的 supabase 改为 realSupabase
      if (supabase && typeof supabase.channel === 'function') {
        channel = supabase
          .channel('schema-db-changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
            },
            (payload) => {
              console.log('数据有变动，正在同步...', payload);
              loadDashboardData();
            }
          )
          .subscribe();
      }
    } catch (error) {
      console.error("Supabase Realtime 初始化失败，但不会让页面卡死:", error);
    }

    // 3. 组件卸载时释放
    return () => {
      try {
        if (channel && supabase && typeof supabase.removeChannel === 'function') {
          supabase.removeChannel(channel);
        }
      } catch (err) {
        console.error("释放通道失败:", err);
      }
    };
  }, []);

  // Handle Receipt Upload (Camera or File select)
  const handleReceiptUpload = async (paymentId: string, file: File | null) => {
    if (!file) return;
    
    setActionLoading(`upload_${paymentId}`);
    setError(null);
    setSuccessMsg(null);

    try {
      const fileExt = file.name.split('.').pop();
      const randId = Math.random().toString(36).substring(2, 10);
      const filePath = `receipts/receipt_${paymentId}_${randId}.${fileExt}`;

      // Upload file to Supabase storage receipts bucket
      const { error: uploadErr } = await supabase.storage
        .from('receipts')
        .upload(filePath, file);
      if (uploadErr) throw uploadErr;

      // Get public URL of uploaded receipt
      const { data: urlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath);
      const receiptUrl = urlData.publicUrl;

      // Update payment record with status and url
      const { error: updateErr } = await supabase
        .from('payments')
        .update({
          status: 'Pending' as PaymentStatus,
          receipt_url: receiptUrl,
        })
        .eq('id', paymentId);

      if (updateErr) throw updateErr;

      setSuccessMsg('Transfer receipt successfully uploaded! Marked as Pending.');
      await loadUserPayments();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to upload receipt. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  // Switch expand/collapse card
  const toggleExpand = (paymentId: string) => {
    setExpandedPaymentId(expandedPaymentId === paymentId ? null : paymentId);
  };

  // Calculations for outstanding bills
  const unpaidPayments = payments.filter(p => p.status === 'Unpaid');
  const pendingPayments = payments.filter(p => p.status === 'Pending');
  
  const totalOutstanding = unpaidPayments.reduce((acc, p) => acc + Number(p.amount_due), 0);

  return (
    <div className="flex-1 pb-24">
      {/* User dashboard Welcome Header */}
      <div className="bg-slate-900 text-white px-6 py-6 rounded-b-[2rem] shadow-lg shadow-slate-900/10 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold text-white uppercase">
              {currentProfile.name.charAt(0)}
            </div>
            <div>
              <p className="text-xs text-slate-400">Welcome Home 🏡</p>
              <h2 className="text-lg font-bold leading-tight">{currentProfile.name}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSwitched && (
              <button
                onClick={onToggleAccount}
                className="p-2.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border border-amber-100 h-10 shadow-sm"
                title="Switch back to Admin"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span className="hidden sm:inline">Exit Perspective</span>
              </button>
            )}
            <button 
              onClick={onLogout}
              className="p-2.5 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer h-10"
              id="user-logout-btn"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Highlight Summary target */}
        <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/30 flex items-center justify-between mt-4">
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Your Balance Due</p>
            <p className={`text-xl font-extrabold mt-1 ${totalOutstanding > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              RM {totalOutstanding.toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] bg-slate-700 px-2.5 py-1 rounded-full text-slate-300 font-semibold">
              {unpaidPayments.length} bills unpaid
            </span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="px-5 space-y-4">
        
        {/* Feedback Notifications */}
        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-600 text-xs rounded-xl p-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs rounded-xl p-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Dashboard Title & Refresh */}
        <div className="flex items-center justify-between pt-1">
          <h3 className="text-base font-bold text-slate-800">Your Share Statements</h3>
          <button
            onClick={loadUserPayments}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            id="refresh-bills-btn"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* PAYMENTS LIST (NEAT CARD STACK LAYOUTS - STAGE MOBILE PRECISION) */}
        <div className="space-y-3.5">
          {loading && payments.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
              <span>Fetching statement entries...</span>
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center bg-white p-8 rounded-2xl border border-slate-100">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">All paid up! 🎉</p>
              <p className="text-xs text-slate-400 mt-1">You have no split statements assigned to you yet.</p>
            </div>
          ) : (
            payments.map(pay => {
              const bill = pay.bill;
              const isExpanded = expandedPaymentId === pay.id;
              
              // Status Styling selectors
              let badgeColor = '';
              let statusLabel = '';
              let statusIcon = null;

              if (pay.status === 'Paid') {
                badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                statusLabel = 'Paid';
                statusIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
              } else if (pay.status === 'Pending') {
                badgeColor = 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse';
                statusLabel = 'Under Review';
                statusIcon = <Clock className="w-3.5 h-3.5 text-amber-600" />;
              } else if (pay.status === 'Reject') {
                badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
                statusLabel = 'Rejected';
                statusIcon = <X className="w-3.5 h-3.5 text-slate-500" />;
              } else {
                badgeColor = 'bg-rose-50 text-rose-700 border-rose-100';
                statusLabel = 'Unpaid';
                statusIcon = <AlertCircle className="w-3.5 h-3.5 text-rose-600" />;
              }

              return (
                <div 
                  key={pay.id} 
                  className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
                    isExpanded 
                      ? 'shadow-md border-blue-100 ring-2 ring-blue-500/5' 
                      : 'shadow-sm border-slate-100 hover:border-slate-200'
                  }`}
                >
                  {/* Card Header Tap Trigger */}
                  <div 
                    onClick={() => toggleExpand(pay.id)}
                    className="p-4 flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      {/* Emoji Icon Badge */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                        bill?.category === 'Rent' 
                          ? 'bg-indigo-50 text-indigo-600' 
                          : bill?.category === 'TNB' 
                            ? 'bg-amber-50 text-amber-600' 
                            : bill?.category === 'Maxis'
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-sky-50 text-sky-600'
                      }`}>
                        {bill?.category === 'Rent' ? '🏠' : bill?.category === 'TNB' ? '⚡' : bill?.category === 'Maxis' ? '📱' : '💧'}
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-slate-800">{bill?.category || 'Statement'}</span>
                          <span className="text-[10px] text-slate-400 font-bold tracking-wider">{bill?.billing_month || ''}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className={`px-2 py-0.5 border rounded-full text-[10px] font-bold flex items-center gap-1 ${badgeColor}`}>
                            {statusIcon}
                            <span>{statusLabel}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-medium">Your Share</span>
                        <span className="text-sm font-extrabold text-slate-800">RM {Number(pay.amount_due).toFixed(2)}</span>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Content Drawer */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-slate-50 bg-slate-50/50 space-y-4">
                      
                      {/* Bill details */}
                      <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-slate-100">
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-semibold">Total Master Bill</p>
                          <p className="text-xs font-bold text-slate-700">RM {bill ? Number(bill.total_amount).toFixed(2) : '0.00'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 uppercase font-semibold">Statement Doc</p>
                          {bill?.document_url ? (
                            <button
                              onClick={() => setViewingDocument(bill.document_url)}
                              className="text-blue-600 text-xs font-bold flex items-center gap-0.5 justify-end mt-0.5 hover:underline cursor-pointer"
                            >
                              <FileText className="w-3 h-3" />
                              <span>View Statement</span>
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 font-semibold block mt-0.5">Not uploaded</span>
                          )}
                        </div>
                      </div>

                      {/* Action blocks based on status */}
                      {pay.status === 'Unpaid' && (
                        <div className="space-y-3">
                          <div className="p-3 bg-rose-50/50 border border-rose-100/50 rounded-xl text-rose-700">
                            <p className="text-xs font-bold flex items-center gap-1">
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Bank Transfer Instructions</span>
                            </p>
                            <p className="text-[11px] text-rose-600/90 leading-snug mt-1 font-medium">
                              Please transfer <span className="font-bold">RM {Number(pay.amount_due).toFixed(2)}</span> to the House Leader's account, snap/screenshot the receipt transfer statement, and upload below.
                            </p>
                          </div>

                          {/* File / Camera Upload Target (TOUCH FRIENDLY >=44PX) */}
                          <div className="relative border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/20 rounded-xl p-4 transition-all text-center">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleReceiptUpload(pay.id, e.target.files ? e.target.files[0] : null)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              disabled={actionLoading === `upload_${pay.id}`}
                            />
                            <div className="flex flex-col items-center justify-center space-y-1.5 py-1">
                              <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md shadow-blue-500/10">
                                <Camera className="w-5 h-5" />
                              </div>
                              <span className="text-sm font-bold text-slate-700 block">
                                {actionLoading === `upload_${pay.id}` ? 'Uploading receipt...' : 'Snap Receipt or Select Photo'}
                              </span>
                              <span className="text-[10px] text-slate-400">Triggers mobile camera automatically</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {pay.status === 'Pending' && (
                        <div className="space-y-2">
                          <div className="p-3 bg-amber-50/50 border border-amber-100/50 rounded-xl text-amber-700 text-xs">
                            <p className="font-bold flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Awaiting Review</span>
                            </p>
                            <p className="text-[11px] text-amber-600 leading-snug mt-1 font-medium">
                              Your transfer slip has been uploaded. The House Leader is reviewing your receipt details and will update the status shortly.
                            </p>
                          </div>
                          {pay.receipt_url && (
                            <button
                              onClick={() => isSwitched ? setSelectedPaymentForReview(pay) : setViewingDocument(pay.receipt_url)}
                              className="w-full py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 flex items-center justify-center gap-1 transition-all cursor-pointer h-10"
                            >
                              {isSwitched ? <Edit2 className="w-3.5 h-3.5 text-blue-500" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                              <span>{isSwitched ? 'Review & Amend Status' : 'Show My Receipt Attachment'}</span>
                            </button>
                          )}
                        </div>
                      )}

                      {pay.status === 'Paid' && (
                        <div className="space-y-2">
                          <div className="p-3 bg-emerald-50/50 border border-emerald-100/50 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>This statement is fully settled! Thank you for paying on time. 😊</span>
                          </div>
                          {pay.receipt_url && (
                            <button
                              onClick={() => isSwitched ? setSelectedPaymentForReview(pay) : setViewingDocument(pay.receipt_url)}
                              className="w-full py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 flex items-center justify-center gap-1 transition-all cursor-pointer h-10"
                            >
                              {isSwitched ? <Edit2 className="w-3.5 h-3.5 text-blue-500" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                              <span>{isSwitched ? 'Review & Amend Status' : 'Show Verified Receipt'}</span>
                            </button>
                          )}
                        </div>
                      )}

                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* DOCUMENT VIEWER MODAL (Full screen on mobile) */}
      <AnimatePresence>
        {viewingDocument && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingDocument(null)}
              className="absolute inset-0 bg-slate-900/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/10 flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Document Attachment</h3>
                    <p className="text-[10px] text-slate-500 font-medium">Viewing verification document</p>
                  </div>
                </div>
                <button 
                  onClick={() => setViewingDocument(null)}
                  className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-auto bg-slate-50 p-4 min-h-0 flex items-center justify-center">
                {viewingDocument.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif|avif)/) || viewingDocument.includes('image') ? (
                  <img 
                    src={viewingDocument} 
                    alt="Uploaded Attachment" 
                    className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="text-center py-12 px-6 max-w-sm mx-auto">
                    <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                      <FileText className="w-10 h-10" />
                    </div>
                    <h4 className="text-lg font-bold text-slate-800 mb-2 font-sans">PDF / Document File</h4>
                    <p className="text-sm text-slate-500 mb-6 font-sans">This document cannot be previewed directly in the app. Please download it to view the full details.</p>
                    
                    <a 
                      href={viewingDocument}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-4 bg-blue-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 h-14"
                    >
                      <Download className="w-5 h-5" />
                      <span>Download & View Document</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                <button
                  onClick={() => setViewingDocument(null)}
                  className="w-full py-3.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl text-sm font-bold transition-all h-14 cursor-pointer"
                >
                  Close Viewer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Payment Detail Modal (Review & Amend Status) */}
      <AnimatePresence>
        {selectedPaymentForReview && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPaymentForReview(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Edit2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Reviewing: {currentProfile.name}</h3>
                    <p className="text-[10px] text-slate-500 font-medium tracking-tight">Admin Override: Perspective Mode</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedPaymentForReview(null)}
                  className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-5 space-y-6">
                {/* Billing Summary */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Billing Statement</p>
                    <p className="text-sm font-bold text-slate-800">
                      {bills.find(b => b.id === selectedPaymentForReview.bill_id)?.category || 'General Bill'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Amount Due</p>
                    <p className="text-sm font-bold text-blue-600">RM {Number(selectedPaymentForReview.amount_due).toFixed(2)}</p>
                  </div>
                </div>

                {/* Status Amendment Group */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-3 px-1 flex items-center gap-2">
                    <ShieldAlert className="w-3 h-3 text-blue-500" />
                    Amend Payment Status
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['Unpaid', 'Pending', 'Paid', 'Reject'] as PaymentStatus[]).map((status) => (
                      <button
                        key={status}
                        onClick={() => handleUpdatePaymentStatus(selectedPaymentForReview.id, status)}
                        disabled={!!actionLoading}
                        className={`py-3.5 px-4 rounded-xl border text-[11px] font-black tracking-widest uppercase flex items-center justify-center gap-2 transition-all cursor-pointer h-12 ${
                          selectedPaymentForReview.status === status
                            ? status === 'Paid' ? 'border-emerald-600 bg-emerald-50 text-emerald-600' :
                              status === 'Pending' ? 'border-amber-600 bg-amber-50 text-amber-600' :
                              status === 'Reject' ? 'border-slate-400 bg-slate-50 text-slate-600' :
                              'border-rose-600 bg-rose-50 text-rose-600'
                            : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                        }`}
                      >
                        {status === 'Unpaid' && <AlertCircle className="w-3 h-3" />}
                        {status === 'Pending' && <Clock className="w-3 h-3" />}
                        {status === 'Paid' && <CheckCircle2 className="w-3 h-3" />}
                        {status === 'Reject' && <X className="w-3 h-3" />}
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Document View */}
                {selectedPaymentForReview.receipt_url ? (
                  <div className="space-y-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold px-1">Attached Receipt</p>
                    <div className="relative aspect-[4/5] bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 group">
                      <img 
                        src={selectedPaymentForReview.receipt_url} 
                        alt="Receipt" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">No Receipt Attachment</p>
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-slate-100 bg-slate-50/50">
                <button
                  onClick={() => setSelectedPaymentForReview(null)}
                  className="w-full py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-all h-14"
                >
                  Done Reviewing
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

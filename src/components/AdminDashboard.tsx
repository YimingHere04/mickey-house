/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile, Bill, PaymentWithDetails, BillCategory, PaymentStatus } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Receipt, CheckCircle, FileSpreadsheet, Plus, Trash2, Edit2,
  Eye, Check, X, LogOut, Sparkles, AlertTriangle, Image as ImageIcon, Calendar, CreditCard, ChevronDown, ChevronUp,
  AlertCircle, Download, FileText, ArrowLeftRight, Home, Zap, Droplets, Wifi, Clock, History
} from 'lucide-react';

interface AdminDashboardProps {
  currentProfile: UserProfile;
  onLogout: () => void;
  isSwitched?: boolean;
  onToggleAccount: () => void;
}

export default function AdminDashboard({ currentProfile, onLogout, isSwitched, onToggleAccount }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'bills' | 'verify' | 'members' | 'reports'>('bills');
  
  // Data lists
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  
  // Form states - Member Management
  const [memberUserId, setMemberUserId] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberPassword, setMemberPassword] = useState('');
  const [memberLinkedUserId, setMemberLinkedUserId] = useState<string | null>(null);
  const [memberRole, setMemberRole] = useState<'admin' | 'member'>('member');
  const [memberFormOpen, setMemberFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'member'>('member');
  const [editUserId, setEditUserId] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editLinkedUserId, setEditLinkedUserId] = useState<string | null>(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [selectedPaymentForReview, setSelectedPaymentForReview] = useState<PaymentWithDetails | null>(null);
  const [approvalHistoryOpen, setApprovalHistoryOpen] = useState(false);
  
  // Form states - Bill Management
  const [billCategory, setBillCategory] = useState<BillCategory>('Rent');
  const [billAmount, setBillAmount] = useState('');
  const [billMonth, setBillMonth] = useState('2026-07');
  const [billFile, setBillFile] = useState<File | null>(null);
  const [billFilterCategory, setBillFilterCategory] = useState<BillCategory | 'All'>('All');
  const [billFilterStatus, setBillFilterStatus] = useState<PaymentStatus | 'All'>('All');
  const [billFormOpen, setBillFormOpen] = useState(false);
  
  // Editing Bill states
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [editBillCategory, setEditBillCategory] = useState<BillCategory>('Rent');
  const [editBillAmount, setEditBillAmount] = useState('');
  const [editBillMonth, setEditBillMonth] = useState('2026-07');
  const [editBillFile, setEditBillFile] = useState<File | null>(null);
  
  // Detail states
  const [viewingDocument, setViewingDocument] = useState<string | null>(null);
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);
  
  // Global loading/error
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Custom Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'danger'
  });

  // Load all dashboard data
  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch profiles
      const { data: profilesData, error: profilesErr } = await supabase
        .from('profiles')
        .select('*')
        .order('name');
      if (profilesErr) throw profilesErr;
      setUsers(profilesData || []);

      // 2. Fetch bills
      const { data: billsData, error: billsErr } = await supabase
        .from('bills')
        .select('*')
        .order('billing_month', { ascending: false });
      if (billsErr) throw billsErr;
      setBills(billsData || []);

      // 3. Fetch payments
      const { data: paymentsData, error: paymentsErr } = await supabase
        .from('payments')
        .select('*');
      if (paymentsErr) throw paymentsErr;
      setPayments(paymentsData || []);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load data. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  // Form reset helpers
  const resetMemberForm = () => {
    setMemberFormOpen(false);
    setEditingMember(null);
    setIsViewOnly(false);
    setMemberName('');
    setMemberUserId('');
    setMemberPassword('');
    setMemberLinkedUserId(null);
    setMemberRole('member');
    setEditName('');
    setEditUserId('');
    setEditPassword('');
    setEditRole('member');
    setEditLinkedUserId(null);
    setError(null);
  };

  const handleCycleStatus = async (paymentId: string, currentStatus: PaymentStatus) => {
    // We now open the detail modal to "view and amend"
    const payment = payments.find(p => p.id === paymentId);
    if (payment) {
      setSelectedPaymentForReview(payment);
    }
  };

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
      await loadDashboardData();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  const resetBillForm = () => {
    setBillFormOpen(false);
    setEditingBill(null);
    setBillAmount('');
    setBillFile(null);
    setEditBillAmount('');
    setEditBillFile(null);
    setError(null);
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Handle User Create
  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('create_member');
    setError(null);
    setSuccessMsg(null);

    const formattedUserId = memberUserId.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_-]+$/.test(formattedUserId)) {
      setError('User ID must contain only letters, numbers, underscores (_), or hyphens (-). No spaces allowed.');
      setActionLoading(null);
      return;
    }

    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        userId: formattedUserId,
        email: `${formattedUserId}@house.com`,
        password: memberPassword || 'password123',
        options: {
          data: {
            name: memberName,
            role: memberRole,
          }
        }
      });
      if (signUpErr) throw signUpErr;

      // Update profile with linked_user_id if provided
      if (data.user && memberLinkedUserId) {
        const { error: profileErr } = await supabase
          .from('profiles')
          .update({ linked_user_id: memberLinkedUserId })
          .eq('id', data.user.id);
        if (profileErr) console.error("Error linking user profile:", profileErr);
      }

      setSuccessMsg(`Successfully registered member: ${memberName} with User ID: '${formattedUserId}'.`);
      setMemberUserId('');
      setMemberName('');
      setMemberPassword('');
      setMemberLinkedUserId(null);
      setMemberRole('member');
      setMemberFormOpen(false);
      await loadDashboardData();
    } catch (err: any) {
      setError(err.message || 'Failed to create member. Profile might already exist.');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle User Delete
  const handleDeleteMember = (memberId: string, memberNameStr: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove User',
      message: `Are you sure you want to remove ${memberNameStr}? This will delete all their assigned payments as well.`,
      type: 'danger',
      onConfirm: async () => {
        setActionLoading(`delete_${memberId}`);
        try {
          // First delete associated payments
          const { error: delPaymentsErr } = await supabase
            .from('payments')
            .delete()
            .eq('user_id', memberId);
          if (delPaymentsErr) throw delPaymentsErr;

          const { error: delErr } = await supabase
            .from('profiles')
            .delete()
            .eq('id', memberId);
          if (delErr) throw delErr;

          setSuccessMsg(`Successfully removed ${memberNameStr}.`);
          await loadDashboardData();
        } catch (err: any) {
          setError(err.message || 'Failed to remove member.');
        } finally {
          setActionLoading(null);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Handle User Update
  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setActionLoading('update_member');
    setError(null);
    setSuccessMsg(null);

    const formattedUserId = editUserId.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_-]+$/.test(formattedUserId)) {
      setError('User ID must contain only letters, numbers, underscores (_), or hyphens (-). No spaces allowed.');
      setActionLoading(null);
      return;
    }

    try {
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          id: formattedUserId,
          name: editName,
          role: editRole,
          password: editPassword,
          linked_user_id: editLinkedUserId,
        })
        .eq('id', editingMember.id);
      if (updateErr) throw updateErr;

      setSuccessMsg(`Successfully updated user details for "${editName}"`);
      setEditingMember(null);
      setEditName('');
      setEditRole('member');
      setEditUserId('');
      setEditPassword('');
      await loadDashboardData();
    } catch (err: any) {
      setError(err.message || 'Failed to update member.');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Bill Create & Auto-Split
  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billAmount || isNaN(Number(billAmount)) || Number(billAmount) <= 0) {
      setError('Please enter a valid bill amount greater than RM 0.');
      return;
    }
    if (users.length === 0) {
      setError('You need at least one member profile in the system to split expenses.');
      return;
    }

    setActionLoading('create_bill');
    setError(null);
    setSuccessMsg(null);

    try {
      let docUrl: string | null = null;

      // Upload Bill Attachment if present
      if (billFile) {
        const fileExt = billFile.name.split('.').pop();
        const randId = Math.random().toString(36).substring(2, 10);
        const filePath = `bills/bill_${randId}_${Date.now()}.${fileExt}`;
        
        const { error: uploadErr } = await supabase.storage
          .from('bills')
          .upload(filePath, billFile);
          
        if (uploadErr) throw uploadErr;
        
        // Get public URL
        const { data: urlData } = supabase.storage
          .from('bills')
          .getPublicUrl(filePath);
        docUrl = urlData.publicUrl;
      }

      // 1. Insert Bill Record
      const amountNum = Number(billAmount);
      const { data: newBill, error: billErr } = await supabase
        .from('bills')
        .insert({
          category: billCategory,
          total_amount: amountNum,
          billing_month: billMonth,
          document_url: docUrl || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=300&q=80', // default mock bill thumbnail
        });

      if (billErr) throw billErr;
      
      const billRecord: Bill = Array.isArray(newBill) ? newBill[0] : newBill;

      // 2. Generate Split Payments
      // Divided equally among House Members only (Admins excluded)
      const targetMembers = users.filter(u => u.role === 'member');
      if (targetMembers.length === 0) {
        throw new Error('There must be at least one registered House User to split this bill.');
      }
      
      const splitAmount = Math.ceil((amountNum / targetMembers.length) * 100) / 100;
      
      const paymentRecords = targetMembers.map(u => ({
        bill_id: billRecord.id,
        user_id: u.id,
        amount_due: splitAmount,
        status: 'Unpaid' as PaymentStatus,
        receipt_url: null,
      }));

      const { error: payErr } = await supabase
        .from('payments')
        .insert(paymentRecords);

      if (payErr) throw payErr;

      setSuccessMsg(`Created ${billCategory} bill for RM ${amountNum}. Split RM ${splitAmount} each among ${targetMembers.length} users (admins excluded).`);
      setBillAmount('');
      setBillFile(null);
      setBillFormOpen(false);
      await loadDashboardData();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create bill and generate split.');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Bill Update
  const handleUpdateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBill) return;

    const amountNum = Number(editBillAmount);
    if (!editBillAmount || isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid bill amount greater than RM 0.');
      return;
    }

    setActionLoading('update_bill');
    setError(null);
    setSuccessMsg(null);

    try {
      let docUrl = editingBill.document_url;

      // Upload new Bill Attachment if present
      if (editBillFile) {
        const fileExt = editBillFile.name.split('.').pop();
        const randId = Math.random().toString(36).substring(2, 10);
        const filePath = `bills/bill_${randId}_${Date.now()}.${fileExt}`;
        
        const { error: uploadErr } = await supabase.storage
          .from('bills')
          .upload(filePath, editBillFile);
          
        if (uploadErr) throw uploadErr;
        
        // Get public URL
        const { data: urlData } = supabase.storage
          .from('bills')
          .getPublicUrl(filePath);
        docUrl = urlData.publicUrl;
      }

      // 1. Update Bill Record
      const { error: billErr } = await supabase
        .from('bills')
        .update({
          category: editBillCategory,
          total_amount: amountNum,
          billing_month: editBillMonth,
          document_url: docUrl,
        })
        .eq('id', editingBill.id);

      if (billErr) throw billErr;

      // 2. Update Split Payments
      // Divided equally among current House Members only (Admins excluded)
      const targetMembers = users.filter(u => u.role === 'member');
      if (targetMembers.length > 0) {
        const splitAmount = Math.ceil((amountNum / targetMembers.length) * 100) / 100;
        
        // We can update all associated payments to the new split amount
        const { error: payErr } = await supabase
          .from('payments')
          .update({ amount_due: splitAmount })
          .eq('bill_id', editingBill.id);

        if (payErr) throw payErr;
      }

      setSuccessMsg(`Successfully updated "${editBillCategory}" bill details to RM ${amountNum}.`);
      setEditingBill(null);
      setEditBillFile(null);
      await loadDashboardData();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update bill.');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle Bill Delete
  const handleDeleteBill = (billId: string, category: string, month: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Bill',
      message: `Are you sure you want to delete the ${category} bill for ${month}? This will delete all associated user payments.`,
      type: 'danger',
      onConfirm: async () => {
        setActionLoading(`delete_bill_${billId}`);
        try {
          // First delete associated payments to satisfy foreign key constraints
          const { error: delPaymentsErr } = await supabase
            .from('payments')
            .delete()
            .eq('bill_id', billId);
          
          if (delPaymentsErr) {
            throw delPaymentsErr;
          }

          const { error: delErr } = await supabase
            .from('bills')
            .delete()
            .eq('id', billId);
          
          if (delErr) {
            throw delErr;
          }

          setSuccessMsg(`Deleted ${category} bill successfully.`);
          await loadDashboardData();
        } catch (err: any) {
          console.error("Delete Error:", err);
          setError(err.message || 'Failed to delete bill.');
        } finally {
          setActionLoading(null);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Verify and Approve Payment (Pending -> Paid)
  const handleVerifyPayment = async (paymentId: string, action: 'approve' | 'reject') => {
    setActionLoading(`verify_${paymentId}_${action}`);
    try {
      const nextStatus: PaymentStatus = action === 'approve' ? 'Paid' : 'Reject';
      const receiptUpdate = action === 'reject' ? null : undefined; // Clear receipt if rejected

      const { error: updateErr } = await supabase
        .from('payments')
        .update({ 
          status: nextStatus,
          ...(receiptUpdate !== undefined ? { receipt_url: receiptUpdate } : {})
        })
        .eq('id', paymentId);

      if (updateErr) throw updateErr;
      setSuccessMsg(action === 'approve' ? 'Payment successfully verified & marked as Paid.' : 'Payment rejected & marked as Reject.');
      setViewingDocument(null);
      await loadDashboardData();
    } catch (err: any) {
      setError(err.message || 'Failed to verify payment.');
    } finally {
      setActionLoading(null);
    }
  };

  // Export Monthly Report to CSV
  const handleExportCSV = () => {
    try {
      // Create comprehensive export rows
      const csvRows = [
        ['Month', 'Category', 'Bill ID', 'Total Amount (RM)', 'Member Name', 'Member Email', 'Amount Due (RM)', 'Payment Status', 'Created At']
      ];

      // Build rows joining payments with their respective bills and users
      payments.forEach(p => {
        const bill = bills.find(b => b.id === p.bill_id);
        const member = users.find(u => u.id === p.user_id);
        
        csvRows.push([
          bill?.billing_month || 'N/A',
          bill?.category || 'N/A',
          p.bill_id,
          bill?.total_amount?.toString() || '0.00',
          member?.name || 'N/A',
          member?.email || 'N/A',
          p.amount_due.toString(),
          p.status,
          p.created_at
        ]);
      });

      const csvContent = "data:text/csv;charset=utf-8," 
        + csvRows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `mickey_house_report_${billMonth}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccessMsg('CSV Monthly Report generated successfully.');
    } catch (err) {
      setError('Failed to generate CSV export.');
    }
  };

  // Helper selectors
  const pendingPayments = payments.filter(p => p.status === 'Pending');
  
  // Total stats calculations
  const totalInvoiced = bills.reduce((acc, b) => acc + Number(b.total_amount), 0);
  const totalPaid = payments.filter(p => p.status === 'Paid').reduce((acc, p) => acc + Number(p.amount_due), 0);
  const totalPending = payments.filter(p => p.status === 'Pending').reduce((acc, p) => acc + Number(p.amount_due), 0);
  const totalUnpaid = payments.filter(p => p.status === 'Unpaid').reduce((acc, p) => acc + Number(p.amount_due), 0);

  return (
    <div className="flex-1 pb-24">
      {/* Admin Header */}
      <div className="bg-slate-900 text-white px-6 py-6 rounded-b-[2rem] shadow-lg shadow-slate-900/10 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Welcome, Leader 👑</p>
              <h2 className="text-lg font-bold leading-tight">{currentProfile.name}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currentProfile.linked_user_id && (
              <button
                onClick={onToggleAccount}
                className="p-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer border border-emerald-100 h-10 shadow-sm"
                title="View as House Member"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span className="hidden sm:inline">Switch Perspective</span>
              </button>
            )}
            <button 
              onClick={onLogout}
              className="p-2.5 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer h-10"
              id="admin-logout-btn"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mini stats carousel (Stacked on mobile, row on desktop) */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-slate-800/80 rounded-2xl p-3 border border-slate-700/30">
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Total Collected</p>
            <p className="text-lg font-extrabold text-emerald-400 mt-1">RM {totalPaid.toFixed(2)}</p>
          </div>
          <div className="bg-slate-800/80 rounded-2xl p-3 border border-slate-700/30">
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Outstanding</p>
            <p className="text-lg font-extrabold text-rose-400 mt-1">RM {totalUnpaid.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-5 space-y-6">
        
        {/* Alerts Block */}
        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-600 text-xs rounded-xl p-3 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs rounded-xl p-3 mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Horizontal Navigation Pills (Super friendly on phone screen) */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setActiveTab('bills')}
            className={`px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all cursor-pointer h-10 ${
              activeTab === 'bills' 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/15' 
                : 'bg-white text-slate-500 border border-slate-100'
            }`}
            id="tab-bills-btn"
          >
            Bills ({bills.length})
          </button>
          <button
            onClick={() => setActiveTab('verify')}
            className={`px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all cursor-pointer relative h-10 ${
              activeTab === 'verify' 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/15' 
                : 'bg-white text-slate-500 border border-slate-100'
            }`}
            id="tab-verify-btn"
          >
            <span>Verify Receipts</span>
            {pendingPayments.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-slate-50 animate-pulse">
                {pendingPayments.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all cursor-pointer h-10 ${
              activeTab === 'members' 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/15' 
                : 'bg-white text-slate-500 border border-slate-100'
            }`}
            id="tab-members-btn"
          >
            Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all cursor-pointer h-10 ${
              activeTab === 'reports' 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/15' 
                : 'bg-white text-slate-500 border border-slate-100'
            }`}
            id="tab-reports-btn"
          >
            Export & Reports
          </button>
        </div>

        {/* TAB 1: MANAGE BILLS */}
        {activeTab === 'bills' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Invoice Dashboard</h3>
              <button
                onClick={() => setBillFormOpen(!billFormOpen)}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer h-10"
                id="open-bill-form-btn"
              >
                <Plus className="w-4 h-4" />
                <span>Add Bill</span>
              </button>
            </div>

            {/* Filter Group */}
            <div className="space-y-3">
              {/* Category Filter */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                {(['All', 'Rent', 'TNB', 'Air Selangor', 'Maxis'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setBillFilterCategory(cat)}
                    className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all cursor-pointer h-9 flex items-center gap-2 border ${
                      billFilterCategory === cat
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    {cat === 'All' && <FileSpreadsheet className="w-4 h-4" />}
                    {cat === 'Rent' && <Home className="w-4 h-4" />}
                    {cat === 'TNB' && <Zap className="w-4 h-4" />}
                    {cat === 'Air Selangor' && <Droplets className="w-4 h-4" />}
                    {cat === 'Maxis' && <Wifi className="w-4 h-4" />}
                    <span>{cat}</span>
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                {(['All', 'Unpaid', 'Pending', 'Paid', 'Reject'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setBillFilterStatus(status)}
                    className={`px-4 py-2 rounded-full text-[11px] uppercase tracking-widest font-black whitespace-nowrap transition-all cursor-pointer h-8 flex items-center gap-1.5 border ${
                      billFilterStatus === status
                        ? status === 'All' ? 'bg-slate-800 text-white border-slate-800 shadow-sm' :
                          status === 'Unpaid' ? 'bg-rose-500 text-white border-rose-500 shadow-sm' :
                          status === 'Pending' ? 'bg-amber-500 text-white border-amber-500 shadow-sm' :
                          status === 'Paid' ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm' :
                          'bg-slate-500 text-white border-slate-500 shadow-sm'
                        : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    {status === 'All' && <CheckCircle className="w-3 h-3" />}
                    {status === 'Unpaid' && <AlertCircle className="w-3 h-3" />}
                    {status === 'Pending' && <Clock className="w-3 h-3" />}
                    {status === 'Paid' && <CheckCircle className="w-3 h-3" />}
                    {status === 'Reject' && <X className="w-3 h-3" />}
                    <span>{status === 'All' ? 'All Status' : status}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Bills Card List */}
            <div className="space-y-3.5">
              {bills.filter(b => {
                const categoryMatch = billFilterCategory === 'All' || b.category === billFilterCategory;
                const billPayments = payments.filter(p => p.bill_id === b.id);
                const statusMatch = billFilterStatus === 'All' || billPayments.some(p => p.status === billFilterStatus);
                return categoryMatch && statusMatch;
              }).length === 0 ? (
                <div className="text-center bg-white p-8 rounded-2xl border border-slate-100">
                  <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">No {billFilterCategory !== 'All' ? `${billFilterCategory} ` : ''}bills matching status</p>
                  <p className="text-xs text-slate-400 mt-1">Try clearing filters or adding new records.</p>
                </div>
              ) : (
                bills
                  .filter(b => {
                    const categoryMatch = billFilterCategory === 'All' || b.category === billFilterCategory;
                    const billPayments = payments.filter(p => p.bill_id === b.id);
                    const statusMatch = billFilterStatus === 'All' || billPayments.some(p => p.status === billFilterStatus);
                    return categoryMatch && statusMatch;
                  })
                  .map(bill => {
                  const billPayments = payments.filter(p => p.bill_id === bill.id);
                  const isExpanded = expandedBillId === bill.id;
                  
                  // Paid vs Unpaid counters for this specific bill
                  const paidCount = billPayments.filter(p => p.status === 'Paid').length;
                  const totalCount = billPayments.length;
                  
                  return (
                    <div 
                      key={bill.id} 
                      className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3.5"
                    >
                      {/* Top Header Card */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          {/* Category badge */}
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            bill.category === 'Rent' 
                              ? 'bg-indigo-50 text-indigo-600' 
                              : bill.category === 'TNB' 
                                ? 'bg-amber-50 text-amber-600' 
                                : bill.category === 'Maxis'
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-sky-50 text-sky-600'
                          }`}>
                            <span className="text-xs font-bold">
                              {bill.category === 'Rent' ? '🏠' : bill.category === 'TNB' ? '⚡' : bill.category === 'Maxis' ? '📱' : '💧'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">{bill.billing_month}</span>
                            <span className="text-sm font-bold text-slate-800">{bill.category} Statement</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs text-slate-400 block font-medium">Total Bill</span>
                          <span className="text-base font-extrabold text-slate-800">RM {Number(bill.total_amount).toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Split Status indicator bar */}
                      <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100/50">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-slate-500 text-[11px] font-semibold">
                            Collected: {paidCount}/{totalCount} paid
                          </span>
                        </div>
                        <button
                          onClick={() => setExpandedBillId(isExpanded ? null : bill.id)}
                          className="text-blue-600 text-[11px] font-bold flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>{isExpanded ? 'Hide Splits' : 'View Splits'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {/* Expanded Bill Split Members */}
                      {isExpanded && (
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Household Shares</h5>
                          {billPayments.map(p => {
                            const member = users.find(u => u.id === p.user_id);
                            return (
                              <div key={p.id} className="flex items-center justify-between text-xs bg-slate-50/50 p-2 rounded-lg">
                                <span className="font-semibold text-slate-600">{member?.name || 'Loading...'}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-500 font-medium">RM {Number(p.amount_due).toFixed(2)}</span>
                                  <button 
                                    onClick={() => handleCycleStatus(p.id, p.status)}
                                    disabled={actionLoading === `status_${p.id}`}
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer hover:opacity-80 active:scale-95 disabled:opacity-50 ${
                                      p.status === 'Paid' 
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                        : p.status === 'Pending' 
                                          ? 'bg-amber-50 text-amber-700 border border-amber-100' 
                                          : p.status === 'Reject'
                                            ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                            : 'bg-rose-50 text-rose-700 border border-rose-100'
                                    }`}
                                  >
                                    {actionLoading === `status_${p.id}` ? '...' : p.status}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Action Triggers */}
                      <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                        {bill.document_url ? (
                          <button 
                            onClick={() => setViewingDocument(bill.document_url!)}
                            className="text-blue-600 text-xs font-bold flex items-center gap-1 cursor-pointer bg-transparent border-none"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View PDF/Photo</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">No attached document</span>
                        )}

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingBill(bill);
                              setEditBillCategory(bill.category);
                              setEditBillAmount(bill.total_amount.toString());
                              setEditBillMonth(bill.billing_month);
                              setEditBillFile(null);
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-all cursor-pointer"
                            title="Edit bill"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteBill(bill.id, bill.category, bill.billing_month)}
                            disabled={actionLoading === `delete_bill_${bill.id}`}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                            title="Delete bill"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modals are defined at the end of the file */}
          </div>
        )}

        {/* TAB 2: VERIFY RECEIPTS */}
        {activeTab === 'verify' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Pending Review ({pendingPayments.length})</h3>
              <button
                onClick={() => setApprovalHistoryOpen(true)}
                className="px-3.5 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer h-10"
              >
                <History className="w-4 h-4" />
                <span>Approval History</span>
              </button>
            </div>
            
            {pendingPayments.length === 0 ? (
              <div className="text-center bg-white p-8 rounded-2xl border border-slate-100">
                <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">Perfect! All clear</p>
                <p className="text-xs text-slate-400 mt-1">There are no pending bank transfers to verify.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingPayments.map(p => {
                  const bill = bills.find(b => b.id === p.bill_id);
                  const member = users.find(u => u.id === p.user_id);
                  
                  return (
                    <div 
                      key={p.id} 
                      className="bg-white rounded-2xl p-4 border border-amber-100 bg-amber-50/10 shadow-sm space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-800">{member?.name || 'Unknown User'}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{bill?.category} - {bill?.billing_month}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Transferred</p>
                          <p className="text-sm font-extrabold text-slate-800">RM {Number(p.amount_due).toFixed(2)}</p>
                        </div>
                      </div>

                      {/* Attachment Link or Quick Preview */}
                      {p.receipt_url && (
                        <div className="pt-1.5">
                          <button
                            onClick={() => setViewingDocument(p.receipt_url)}
                            className="w-full py-2 bg-slate-100/80 hover:bg-slate-200/50 rounded-xl text-xs font-bold text-slate-600 flex items-center justify-center gap-1.5 transition-all cursor-pointer h-10"
                          >
                            <Eye className="w-4 h-4 text-slate-500" />
                            <span>View Bank Receipt Slip</span>
                          </button>
                        </div>
                      )}

                      {/* Review Buttons */}
                      <div className="flex gap-2.5 border-t border-slate-100/50 pt-3">
                        <button
                          onClick={() => handleVerifyPayment(p.id, 'reject')}
                          disabled={actionLoading?.startsWith('verify_')}
                          className="flex-1 py-2.5 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer h-10"
                        >
                          <X className="w-4 h-4" />
                          <span>Reject</span>
                        </button>
                        <button
                          onClick={() => handleVerifyPayment(p.id, 'approve')}
                          disabled={actionLoading?.startsWith('verify_')}
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer h-10"
                        >
                          <Check className="w-4 h-4" />
                          <span>Approve</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MANAGE MEMBERS */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Admin and Member List</h3>
              <button
                onClick={() => {
                  setMemberFormOpen(!memberFormOpen);
                  setEditingMember(null);
                }}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer h-10"
                id="open-member-form-btn"
              >
                <Plus className="w-4 h-4" />
                <span>Add User</span>
              </button>
            </div>

            {/* Member Listing */}
            <div className="space-y-3">
              {users.map(member => (
                <div 
                  key={member.id} 
                  className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-600 uppercase">
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <span>{member.name}</span>
                        {member.role === 'admin' && (
                          <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[8px] font-bold uppercase tracking-wider">Admin</span>
                        )}
                        {member.linked_user_id && (
                          <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[8px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-emerald-400" />
                            Linked: {users.find(u => u.id === member.linked_user_id)?.name || member.linked_user_id}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">ID: {member.id}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingMember(member);
                        setEditName(member.name);
                        setEditRole(member.role);
                        setEditUserId(member.id);
                        setEditPassword(member.password || 'password123');
                        setEditLinkedUserId(member.linked_user_id || null);
                        setMemberFormOpen(false);
                      }}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
                      title="Edit user details"
                    >
                      <Edit2 className="w-4.5 h-4.5" />
                    </button>

                    {member.id === currentProfile.id && (
                      <button
                        onClick={() => {
                          setEditingMember(member);
                          setEditName(member.name);
                          setEditRole(member.role);
                          setEditUserId(member.id);
                          setEditPassword(member.password || 'password123');
                          setEditLinkedUserId(member.linked_user_id || null);
                          setIsViewOnly(true);
                          setMemberFormOpen(true);
                        }}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all cursor-pointer"
                        title="View My Profile"
                      >
                        <Eye className="w-4.5 h-4.5" />
                      </button>
                    )}

                    {member.id !== currentProfile.id && (
                      <button
                        onClick={() => handleDeleteMember(member.id, member.name)}
                        disabled={actionLoading === `delete_${member.id}`}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                        title="Remove user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: REPORTS & CSV EXPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-4 bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-3">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-bold text-slate-800">Monthly Statement Export</h3>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Compile all current household invoices, utility shares, and residents' payment verification statuses into a clean, standard CSV file. This report is perfect for keeping long-term records or sharing in the house WhatsApp group.
            </p>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-slate-600 space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Total Bills Created:</span>
                <span className="font-bold text-slate-800">{bills.length} bills</span>
              </div>
              <div className="flex justify-between">
                <span>Registered Residents:</span>
                <span className="font-bold text-slate-800">{users.length} members</span>
              </div>
              <div className="flex justify-between border-t border-slate-200/50 pt-1.5">
                <span>Sum Invoiced:</span>
                <span className="font-bold text-slate-800">RM {totalInvoiced.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>Verified Received:</span>
                <span className="font-bold">RM {totalPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-rose-500">
                <span>Outstanding Balance:</span>
                <span className="font-bold">RM {totalUnpaid.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleExportCSV}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold tracking-wide shadow-md shadow-blue-500/15 transition-all flex items-center justify-center gap-2 cursor-pointer h-12"
              id="export-csv-btn"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Download Complete CSV Report</span>
            </button>
          </div>
        )}

      </div>

      {/* DOCUMENT VIEWING FULLSCREEN POPUP MODAL */}
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
                    <h3 className="text-sm font-bold text-slate-900">Attachment Review</h3>
                    <p className="text-[10px] text-slate-500 font-medium">Verify before taking action</p>
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
                    <p className="text-sm text-slate-500 mb-6 font-sans">This document cannot be previewed directly. Please download it to view.</p>
                    
                    <a 
                      href={viewingDocument}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-4 bg-blue-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 h-14"
                    >
                      <Download className="w-5 h-5" />
                      <span>Download & Open File</span>
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
                  Close Attachment
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Global Confirmation Modal */}
      {/* Add/Edit Bill Modal */}
      <AnimatePresence>
        {(billFormOpen || editingBill) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={resetBillForm}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    {editingBill ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      {editingBill ? 'Edit Invoice' : 'New Utility Bill'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {editingBill ? 'Update the details for this bill.' : 'Enter details to create and split a new bill.'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={resetBillForm}
                  className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <form onSubmit={editingBill ? handleUpdateBill : handleCreateBill} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Category</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['Rent', 'TNB', 'Air Selangor', 'Maxis'] as BillCategory[]).map(cat => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => editingBill ? setEditBillCategory(cat) : setBillCategory(cat)}
                            className={`py-2 px-3 flex items-center gap-2 text-sm font-bold rounded-lg border transition-all h-10 cursor-pointer ${
                              (editingBill ? editBillCategory : billCategory) === cat
                                ? 'border-blue-600 bg-blue-50 text-blue-600 shadow-sm'
                                : 'border-slate-100 bg-slate-50 text-slate-500'
                            }`}
                          >
                            {cat === 'Rent' && <Home className="w-4 h-4" />}
                            {cat === 'TNB' && <Zap className="w-4 h-4" />}
                            {cat === 'Air Selangor' && <Droplets className="w-4 h-4" />}
                            {cat === 'Maxis' && <Wifi className="w-4 h-4" />}
                            <span className="truncate">{cat}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Billing Month</label>
                      <input
                        type="month"
                        required
                        value={editingBill ? editBillMonth : billMonth}
                        onChange={(e) => editingBill ? setEditBillMonth(e.target.value) : setBillMonth(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700 font-semibold h-11"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Total Amount (RM)</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 text-sm font-bold">RM</span>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="0.00"
                        value={editingBill ? editBillAmount : billAmount}
                        onChange={(e) => editingBill ? setEditBillAmount(e.target.value) : setBillAmount(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 font-extrabold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Bill Document (PDF/Photo)</label>
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center bg-slate-50 relative hover:border-blue-300 transition-all group">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => editingBill ? setEditBillFile(e.target.files ? e.target.files[0] : null) : setBillFile(e.target.files ? e.target.files[0] : null)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                      />
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-400 group-hover:text-blue-500 shadow-sm transition-colors">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-slate-600">
                          {editingBill 
                            ? (editBillFile ? editBillFile.name : 'Replace current document (Optional)')
                            : (billFile ? billFile.name : 'Tap to capture / select document')
                          }
                        </span>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">PDF, JPG, PNG allowed</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={resetBillForm}
                      className="flex-1 py-3.5 border border-slate-100 bg-slate-50 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors h-14 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!!actionLoading}
                      className="flex-[1.5] py-3.5 bg-blue-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all h-14 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : editingBill ? 'Update Bill' : 'Split & Save Bill'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Member Modal */}
      <AnimatePresence>
        {(memberFormOpen || editingMember) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={resetMemberForm}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    {isViewOnly ? <Eye className="w-5 h-5" /> : (editingMember ? <Edit2 className="w-5 h-5" /> : <Users className="w-5 h-5" />)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      {isViewOnly ? 'View My Account' : (editingMember ? 'Edit Resident' : 'Add New Resident')}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {isViewOnly ? 'Your household profile details.' : (editingMember ? 'Update household credentials.' : 'Register a new member to the household.')}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={resetMemberForm}
                  className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <form onSubmit={editingMember ? handleUpdateMember : handleCreateMember} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Full Display Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mohd Daniel"
                      value={editingMember ? editName : memberName}
                      onChange={(e) => editingMember ? setEditName(e.target.value) : setMemberName(e.target.value)}
                      readOnly={isViewOnly}
                      className={`w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700 font-bold ${isViewOnly ? 'cursor-default opacity-80' : ''}`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">User Login ID</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. daniel123"
                      value={editingMember ? editUserId : memberUserId}
                      onChange={(e) => editingMember ? setEditUserId(e.target.value) : setMemberUserId(e.target.value)}
                      readOnly={isViewOnly}
                      className={`w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700 ${editingMember ? 'opacity-60 cursor-not-allowed' : ''} ${isViewOnly ? 'cursor-default opacity-80' : ''}`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Password</label>
                    <input
                      type="text"
                      required
                      placeholder="Secret password"
                      value={editingMember ? editPassword : memberPassword}
                      onChange={(e) => editingMember ? setEditPassword(e.target.value) : setMemberPassword(e.target.value)}
                      readOnly={isViewOnly}
                      className={`w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700 ${isViewOnly ? 'cursor-default opacity-80' : ''}`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Access Role</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => !isViewOnly && (editingMember ? setEditRole('member') : setMemberRole('member'))}
                        className={`py-3 px-4 rounded-xl border text-sm font-bold flex items-center justify-center gap-1.5 transition-all h-12 ${isViewOnly ? 'cursor-default' : 'cursor-pointer'} ${
                          (editingMember ? editRole : memberRole) === 'member'
                            ? 'border-blue-600 bg-blue-50 text-blue-600'
                            : 'border-slate-100 bg-slate-50 text-slate-500'
                        }`}
                      >
                        House Member
                      </button>
                      <button
                        type="button"
                        onClick={() => !isViewOnly && (editingMember ? setEditRole('admin') : setMemberRole('admin'))}
                        className={`py-3 px-4 rounded-xl border text-sm font-bold flex items-center justify-center gap-1.5 transition-all h-12 ${isViewOnly ? 'cursor-default' : 'cursor-pointer'} ${
                          (editingMember ? editRole : memberRole) === 'admin'
                            ? 'border-blue-600 bg-blue-50 text-blue-600'
                            : 'border-slate-100 bg-slate-50 text-slate-500'
                        }`}
                      >
                        Admin
                      </button>
                    </div>
                  </div>

                  {(editingMember ? editRole : memberRole) === 'admin' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-1.5"
                    >
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Link to Member Profile</label>
                      <div className="relative">
                        <select
                          value={(editingMember ? editLinkedUserId : memberLinkedUserId) || ''}
                          onChange={(e) => editingMember ? setEditLinkedUserId(e.target.value || null) : setMemberLinkedUserId(e.target.value || null)}
                          disabled={isViewOnly}
                          className={`w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700 font-bold appearance-none ${isViewOnly ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
                        >
                          <option value="">-- No Link --</option>
                          {users
                            .filter(u => u.role === 'member' && (!editingMember || u.id !== editingMember.id))
                            .map(u => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.id})
                              </option>
                            ))
                          }
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium px-1">
                        Connect this admin to a regular member profile for unified accounting.
                      </p>
                    </motion.div>
                  )}

                  <div className="flex gap-3 pt-3">
                    <button
                      type="button"
                      onClick={resetMemberForm}
                      className="flex-1 py-3.5 border border-slate-100 bg-slate-50 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors h-14 cursor-pointer"
                    >
                      {isViewOnly ? 'Close View' : 'Cancel'}
                    </button>
                    {!isViewOnly && (
                      <button
                        type="submit"
                        disabled={!!actionLoading}
                        className="flex-[1.5] py-3.5 bg-blue-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all h-14 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {actionLoading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : editingMember ? 'Update Profile' : 'Save Resident'}
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="p-6 text-center">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                  confirmModal.type === 'danger' ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-500'
                }`}>
                  {confirmModal.type === 'danger' ? <Trash2 className="w-7 h-7" /> : <AlertCircle className="w-7 h-7" />}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{confirmModal.title}</h3>
                <p className="text-slate-500 leading-relaxed text-sm">{confirmModal.message}</p>
              </div>
              <div className="p-6 bg-slate-50 flex gap-3">
                <button
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-3.5 px-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-100 transition-all cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  disabled={!!actionLoading}
                  className={`flex-1 py-3.5 px-4 text-white font-bold rounded-2xl transition-all shadow-lg cursor-pointer disabled:opacity-50 text-sm ${
                    confirmModal.type === 'danger' ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-200' : 'bg-blue-500 hover:bg-blue-600 shadow-blue-200'
                  }`}
                >
                  {actionLoading ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Payment Detail Modal */}
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
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Payment Review</h3>
                    <p className="text-[10px] text-slate-500 font-medium">Verify and update payment status</p>
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
                {/* Member Info */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Payee Resident</p>
                    <p className="text-sm font-bold text-slate-800">
                      {users.find(u => u.id === selectedPaymentForReview.user_id)?.name || 'Unknown'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Amount Due</p>
                    <p className="text-sm font-bold text-blue-600">RM {Number(selectedPaymentForReview.amount_due).toFixed(2)}</p>
                  </div>
                </div>

                {/* Status Toggle Group */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-3 px-1">Amend Payment Status</p>
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
                        {status === 'Paid' && <CheckCircle className="w-3 h-3" />}
                        {status === 'Reject' && <X className="w-3 h-3" />}
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Receipt View */}
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
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <a 
                          href={selectedPaymentForReview.receipt_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-white text-slate-900 rounded-xl text-xs font-bold shadow-xl flex items-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          View Full Resolution
                        </a>
                      </div>
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
      {/* Approval History Modal */}
      <AnimatePresence>
        {approvalHistoryOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setApprovalHistoryOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Approval History</h3>
                    <p className="text-[10px] text-slate-500 font-medium">Previously verified and rejected payments</p>
                  </div>
                </div>
                <button 
                  onClick={() => setApprovalHistoryOpen(false)}
                  className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-5">
                <div className="space-y-3">
                  {(() => {
                    const history = payments.filter(p => p.status === 'Paid' || p.status === 'Reject');
                    if (history.length === 0) {
                      return (
                        <div className="text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-sm font-bold text-slate-500">No History Yet</p>
                          <p className="text-xs text-slate-400 mt-1">Approvals and rejections will appear here.</p>
                        </div>
                      );
                    }
                    return history.map(p => {
                      const member = users.find(u => u.id === p.user_id);
                      const bill = bills.find(b => b.id === p.bill_id);
                      return (
                        <div key={p.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${p.status === 'Paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                              {p.status === 'Paid' ? <CheckCircle className="w-5 h-5" /> : <X className="w-5 h-5" />}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800">{member?.name || 'Unknown'}</p>
                              <p className="text-[11px] text-slate-500">{bill?.category || 'Bill'} &middot; RM {Number(p.amount_due).toFixed(2)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                              p.status === 'Paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {p.status}
                            </span>
                            <button
                              onClick={() => {
                                setApprovalHistoryOpen(false);
                                setSelectedPaymentForReview(p as PaymentWithDetails);
                              }}
                              className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

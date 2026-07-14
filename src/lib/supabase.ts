/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';
import { UserProfile, UserRole, Bill, Payment, BillCategory, PaymentStatus } from '../types';

// Read configuration from environment variables
const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

export const IS_DEMO_MODE = false;

// Real Supabase client instance (or null if in demo mode)
export const realSupabase = IS_DEMO_MODE 
  ? null 
  : createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);

// ====================================================================
// HIGH-FIDELITY LOCAL STORAGE SIMULATOR (DEMO MODE)
// ====================================================================

// Initial mock data if storage is empty
const INITIAL_USERS: UserProfile[] = [
  { id: 'Admin', email: 'Admin@house.com', name: 'Admin', role: 'admin', password: '111111' },
  { id: 'user1', email: 'user1@house.com', name: 'Hong', role: 'member', password: '000000' },
  { id: 'user2', email: 'user2@house.com', name: 'Yiming', role: 'member', password: '000000' },
  { id: 'user3', email: 'user3@house.com', name: 'Baoyi', role: 'member', password: '000000' },
];

const INITIAL_BILLS: Bill[] = [
  {
    id: 'bill-1',
    category: 'Rent',
    total_amount: 1600.00,
    billing_month: '2026-06',
    document_url: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=300&q=80',
    created_at: new Date('2026-06-01T08:00:00Z').toISOString(),
  },
  {
    id: 'bill-2',
    category: 'TNB',
    total_amount: 240.60,
    billing_month: '2026-06',
    document_url: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=300&q=80',
    created_at: new Date('2026-06-05T09:30:00Z').toISOString(),
  },
];

const INITIAL_PAYMENTS: Payment[] = [
  // Rent split
  { id: 'pay-1', bill_id: 'bill-1', user_id: 'usr-member-1', amount_due: 400.00, status: 'Paid', receipt_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=300&q=80', created_at: new Date('2026-06-01T08:05:00Z').toISOString() },
  { id: 'pay-2', bill_id: 'bill-1', user_id: 'usr-member-2', amount_due: 400.00, status: 'Pending', receipt_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=300&q=80', created_at: new Date('2026-06-01T08:05:00Z').toISOString() },
  { id: 'pay-3', bill_id: 'bill-1', user_id: 'usr-member-3', amount_due: 400.00, status: 'Unpaid', receipt_url: null, created_at: new Date('2026-06-01T08:05:00Z').toISOString() },
  { id: 'pay-4', bill_id: 'bill-1', user_id: 'usr-admin-1', amount_due: 400.00, status: 'Paid', receipt_url: null, created_at: new Date('2026-06-01T08:05:00Z').toISOString() },
  // TNB split
  { id: 'pay-5', bill_id: 'bill-2', user_id: 'usr-member-1', amount_due: 60.15, status: 'Paid', receipt_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=300&q=80', created_at: new Date('2026-06-05T09:35:00Z').toISOString() },
  { id: 'pay-6', bill_id: 'bill-2', user_id: 'usr-member-2', amount_due: 60.15, status: 'Unpaid', receipt_url: null, created_at: new Date('2026-06-05T09:35:00Z').toISOString() },
  { id: 'pay-7', bill_id: 'bill-2', user_id: 'usr-member-3', amount_due: 60.15, status: 'Unpaid', receipt_url: null, created_at: new Date('2026-06-05T09:35:00Z').toISOString() },
  { id: 'pay-8', bill_id: 'bill-2', user_id: 'usr-admin-1', amount_due: 60.15, status: 'Paid', receipt_url: null, created_at: new Date('2026-06-05T09:35:00Z').toISOString() },
];

const getLocalStorage = <T>(key: string, initial: T): T => {
  const val = localStorage.getItem(key);
  if (!val) {
    localStorage.setItem(key, JSON.stringify(initial));
    return initial;
  }
  try {
    return JSON.parse(val);
  } catch {
    return initial;
  }
};

const setLocalStorage = <T>(key: string, val: T): void => {
  localStorage.setItem(key, JSON.stringify(val));
};

// State initializers for Demo Mode
let mockUsers: UserProfile[] = getLocalStorage('demo_users2', INITIAL_USERS);
let mockBills: Bill[] = getLocalStorage('demo_bills', INITIAL_BILLS);
let mockPayments: Payment[] = getLocalStorage('demo_payments', INITIAL_PAYMENTS);
let currentUser: UserProfile | null = getLocalStorage('demo_current_user', INITIAL_USERS[0]); // Default to admin for convenient viewing

// Helper to save current state
const saveState = () => {
  setLocalStorage('demo_users2', mockUsers);
  setLocalStorage('demo_bills', mockBills);
  setLocalStorage('demo_payments', mockPayments);
  setLocalStorage('demo_current_user', currentUser);
};

// Simulated Event Listener for Auth Changes
type AuthChangeListener = (event: string, session: any) => void;
const authListeners: AuthChangeListener[] = [];

// High fidelity chainable query interface simulator
class MockQueryBuilder {
  private table: string;
  private filterField: string | null = null;
  private filterValue: any = null;
  private orderByField: string | null = null;
  private orderAscending: boolean = true;
  private isSingle: boolean = false;
  private operation: 'select' | 'insert' | 'update' | 'delete' | null = null;
  private operationPayload: any = null;

  constructor(table: string) {
    this.table = table;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  eq(field: string, value: any) {
    this.filterField = field;
    this.filterValue = value;
    return this;
  }

  order(field: string, options: { ascending?: boolean } = {}) {
    this.orderByField = field;
    this.orderAscending = options.ascending ?? true;
    return this;
  }

  select(columns: string = '*') {
    this.operation = 'select';
    this.operationPayload = columns;
    return this;
  }

  insert(records: any | any[]) {
    this.operation = 'insert';
    this.operationPayload = records;
    return this;
  }

  update(changes: any) {
    this.operation = 'update';
    this.operationPayload = changes;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  // The executor that runs when the builder is awaited
  // 注入了真实 Supabase 交互的云端直连 executor 引擎
  async execute() {
    // 💡 1. 拦截 SELECT 操作（从云端读取）
    if (this.operation === 'select') {
      try {
        if (realSupabase) {
          let query = realSupabase.from(this.table).select('*');
          
          if (this.filterField) {
            query = query.eq(this.filterField, this.filterValue);
          }
          if (this.orderByField) {
            query = query.order(this.orderByField, { ascending: this.orderAscending });
          }
          
          const { data: cloudData, error: cloudError } = await query;
          if (!cloudError && cloudData) {
            let sourceList = cloudData;
            // 保持原有的付款联表逻辑
            if (this.table === 'payments') {
              const { data: allBills } = await realSupabase.from('bills').select('*');
              const { data: allProfiles } = await realSupabase.from('profiles').select('*');
              sourceList = sourceList.map(payment => ({
                ...payment,
                bill: (allBills || []).find(b => b.id === payment.bill_id),
                user: (allProfiles || []).find(u => u.id === payment.user_id),
              }));
            }
            const data = this.isSingle ? (sourceList.length > 0 ? sourceList[0] : null) : sourceList;
            return { data, error: null };
          }
        }
      } catch (e) {
        console.error("云端读取失败，降级本地模拟器:", e);
      }

      // 备份备用降级逻辑（原版逻辑）
      let sourceList: any[] = [];
      if (this.table === 'profiles' || this.table === 'users') sourceList = [...mockUsers];
      else if (this.table === 'bills') sourceList = [...mockBills];
      else if (this.table === 'payments') sourceList = [...mockPayments];

      if (this.filterField) {
        sourceList = sourceList.filter(item => {
          const itemVal = item[this.filterField!];
          if (typeof itemVal === 'string' && typeof this.filterValue === 'string') {
            return itemVal.toLowerCase() === this.filterValue.toLowerCase();
          }
          return itemVal === this.filterValue;
        });
      }
      if (this.orderByField) {
        sourceList.sort((a, b) => {
          const valA = a[this.orderByField!];
          const valB = b[this.orderByField!];
          if (valA < valB) return this.orderAscending ? -1 : 1;
          if (valA > valB) return this.orderAscending ? 1 : -1;
          return 0;
        });
      }
      if (this.table === 'payments') {
        sourceList = sourceList.map(payment => ({
          ...payment,
          bill: mockBills.find(b => b.id === payment.bill_id),
          user: mockUsers.find(u => u.id === payment.user_id),
        }));
      }
      const data = this.isSingle ? (sourceList.length > 0 ? sourceList[0] : null) : sourceList;
      return { data, error: null };
    }

    // 💡 2. 拦截 INSERT 操作（写入云端）
    if (this.operation === 'insert') {
      const records = this.operationPayload;
      const recordsArray = Array.isArray(records) ? records : [records];
      const createdRecords: any[] = [];

      for (const record of recordsArray) {
        const id = record.id || `id-${Math.random().toString(36).substr(2, 9)}`;
        const newRecord = {
          ...record,
          id,
          created_at: record.created_at || new Date().toISOString()
        };

        try {
          if (realSupabase) {
            const { error: cloudInsertErr } = await realSupabase.from(this.table).insert([newRecord]);
            if (cloudInsertErr) console.error("同步云端写入失败:", cloudInsertErr);
          }
        } catch (e) {
          console.error("无法写入 Supabase 数据库:", e);
        }

        // 同时维持本地状态防止局部组件断联
        if (this.table === 'profiles' || this.table === 'users') {
          mockUsers.push(newRecord as UserProfile);
        } else if (this.table === 'bills') {
          mockBills.push(newRecord as Bill);
        } else if (this.table === 'payments') {
          mockPayments.push(newRecord as Payment);
        }
        createdRecords.push(newRecord);
      }

      saveState();
      return { data: Array.isArray(records) ? createdRecords : createdRecords[0], error: null };
    }

    // 💡 3. 拦截 UPDATE 操作（更新云端）
    if (this.operation === 'update') {
      const changes = this.operationPayload;
      let affected: any[] = [];

      try {
        if (realSupabase && this.filterField) {
          await realSupabase.from(this.table).update(changes).eq(this.filterField, this.filterValue);
        }
      } catch (e) {
        console.error("同步云端更新失败:", e);
      }

      if (this.table === 'profiles' || this.table === 'users') {
        mockUsers = mockUsers.map(user => {
          if (this.filterField && user[this.filterField as keyof UserProfile] === this.filterValue) {
            const oldId = user.id;
            const updated = { ...user, ...changes };
            if (changes.id && changes.id !== oldId) {
              mockPayments = mockPayments.map(p => p.user_id === oldId ? { ...p, user_id: changes.id } : p);
              updated.email = `${changes.id}@house.com`;
            }
            affected.push(updated);
            return updated;
          }
          return user;
        });
        const updatedUser = affected[0];
        if (updatedUser && currentUser && (currentUser.id === this.filterValue || currentUser.id === updatedUser.id)) {
          currentUser = updatedUser;
        }
      } else if (this.table === 'bills') {
        mockBills = mockBills.map(bill => {
          if (this.filterField && bill[this.filterField as keyof Bill] === this.filterValue) {
            const updated = { ...bill, ...changes };
            affected.push(updated);
            return updated;
          }
          return bill;
        });
      } else if (this.table === 'payments') {
        mockPayments = mockPayments.map(pay => {
          if (this.filterField && pay[this.filterField as keyof Payment] === this.filterValue) {
            const updated = { ...pay, ...changes };
            affected.push(updated);
            return updated;
          }
          return pay;
        });
      }

      saveState();
      return { data: affected, error: null };
    }

    // 💡 4. 拦截 DELETE 操作（从云端删除）
    if (this.operation === 'delete') {
      let deletedCount = 0;

      try {
        if (realSupabase && this.filterField) {
          await realSupabase.from(this.table).delete().eq(this.filterField, this.filterValue);
        }
      } catch (e) {
        console.error("同步云端删除失败:", e);
      }

      if (this.table === 'profiles' || this.table === 'users') {
        const before = mockUsers.length;
        if (this.filterField) mockUsers = mockUsers.filter(user => user[this.filterField as keyof UserProfile] !== this.filterValue);
        deletedCount = before - mockUsers.length;
      } else if (this.table === 'bills') {
        const before = mockBills.length;
        if (this.filterField) {
          mockBills = mockBills.filter(bill => bill[this.filterField as keyof Bill] !== this.filterValue);
          mockPayments = mockPayments.filter(pay => pay.bill_id !== this.filterValue);
        }
        deletedCount = before - mockBills.length;
      } else if (this.table === 'payments') {
        const before = mockPayments.length;
        if (this.filterField) mockPayments = mockPayments.filter(pay => pay[this.filterField as keyof Payment] !== this.filterValue);
        deletedCount = before - mockPayments.length;
      }

      saveState();
      return { data: { deleted: deletedCount }, error: null };
    }

    return { data: null, error: { message: 'No operation specified' } };
  }

  // Thenable implementation
  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

// Storage Bucket Simulator
class MockStorageBucket {
  private bucketName: string;

  constructor(bucketName: string) {
    this.bucketName = bucketName;
  }

  // Mock upload. Receives file / blob, uploads it, returns path/URL
  async upload(filePath: string, file: File | Blob) {
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Convert file to Base64 to support mock display
    return new Promise<{ data: { path: string }; error: any }>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Url = reader.result as string;
        // Store Base64 URL directly in localStorage mapped by file path
        const fileStore = getLocalStorage<Record<string, string>>('demo_storage', {});
        fileStore[filePath] = base64Url;
        setLocalStorage('demo_storage', fileStore);

        resolve({ data: { path: filePath }, error: null });
      };
      reader.onerror = () => {
        resolve({ data: null as any, error: { message: 'Failed to read file' } });
      };
      reader.readAsDataURL(file);
    });
  }

  // Mock getPublicUrl
  getPublicUrl(filePath: string) {
    const fileStore = getLocalStorage<Record<string, string>>('demo_storage', {});
    const base64Url = fileStore[filePath];
    
    // Fallback if not found
    if (!base64Url) {
      if (this.bucketName === 'bills') {
        return { data: { publicUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=300&q=80' } };
      }
      return { data: { publicUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=300&q=80' } };
    }
    return { data: { publicUrl: base64Url } };
  }
}

// Simulated Supabase Client Exports
export const demoSupabase = {
  auth: {
    // Current active profile
    async getUser() {
      return { data: currentUser ? { user: { id: currentUser.id, email: currentUser.email, user_metadata: { name: currentUser.name, role: currentUser.role } } } : { user: null }, error: null };
    },
    
    async getSession() {
      return { 
        data: currentUser ? { 
          session: { 
            user: { id: currentUser.id, email: currentUser.email, user_metadata: { name: currentUser.name, role: currentUser.role } } 
          } 
        } : { session: null }, 
        error: null 
      };
    },

    async signInWithPassword({ email, userId, id, password }: any) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      const loginId = (userId || id || email || '').toLowerCase().trim();
      const user = mockUsers.find(u => 
        u.id.toLowerCase() === loginId || 
        u.id.toLowerCase().replace('usr-', '') === loginId ||
        u.email.toLowerCase() === loginId ||
        u.email.split('@')[0].toLowerCase() === loginId
      );
      if (user) {
        const expectedPassword = user.password || 'password123';
        if (password && password !== expectedPassword) {
          return { data: { user: null, session: null }, error: { message: 'Incorrect password. Please try again.' } };
        }
        currentUser = user;
        saveState();
        authListeners.forEach(listener => listener('SIGNED_IN', { user }));
        return { data: { user, session: { user } }, error: null };
      }
      return { data: { user: null, session: null }, error: { message: 'Invalid credentials. Please enter a valid User ID (e.g., leader, member1, member2) and password.' } };
    },

    async signUp({ email, userId, id, password, options }: any) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const finalUserId = (userId || id || options?.data?.userId || email?.split('@')[0] || `usr-${Math.random().toString(36).substr(2, 9)}`).toLowerCase().trim();
      const finalEmail = email || `${finalUserId}@house.com`;
      const name = options?.data?.name || finalUserId;
      const role = options?.data?.role || 'member';
      
      const exists = mockUsers.some(u => u.id.toLowerCase() === finalUserId || u.email.toLowerCase() === finalEmail.toLowerCase());
      if (exists) {
        return { data: { user: null }, error: { message: 'A user with this User ID already exists.' } };
      }

      const newUser: UserProfile = {
        id: finalUserId,
        email: finalEmail,
        name,
        role: role as UserRole,
        password: password || 'password123',
      };

      mockUsers.push(newUser);
      currentUser = newUser;
      saveState();

      authListeners.forEach(listener => listener('SIGNED_IN', { user: newUser }));
      return { data: { user: newUser, session: { user: newUser } }, error: null };
    },

    async signOut() {
      currentUser = null;
      saveState();
      authListeners.forEach(listener => listener('SIGNED_OUT', null));
      return { error: null };
    },

    onAuthStateChange(callback: AuthChangeListener) {
      authListeners.push(callback);
      // Immediately call with current session status
      callback('INITIAL_SESSION', currentUser ? { user: currentUser } : null);
      return {
        data: {
          subscription: {
            unsubscribe() {
              const idx = authListeners.indexOf(callback);
              if (idx !== -1) authListeners.splice(idx, 1);
            }
          }
        }
      };
    },

    // CUSTOM CONVENIENCE FOR DEMO PREVIEW (Quick Switches)
    setDemoUser(user: UserProfile) {
      currentUser = user;
      saveState();
      authListeners.forEach(listener => listener('SIGNED_IN', { user }));
    }
  },

  from(table: string) {
    return new MockQueryBuilder(table);
  },

  storage: {
    from(bucketName: string) {
      return new MockStorageBucket(bucketName);
    }
  }
};

// 确保全站的组件（包括 Login）都能正确拿到 supabase 实例
export const supabase = realSupabase;
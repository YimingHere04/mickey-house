/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 彻底重写版：全站直连 Supabase 云端数据库，彻底废除 LocalStorage
 */

import { createClient } from '@supabase/supabase-js';
import { UserProfile, UserRole, Bill, Payment, BillCategory, PaymentStatus } from '../types';

const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

// 强行导出真正的云端客户端
export const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
export const realSupabase = supabase;
export const IS_DEMO_MODE = false;

// ==========================================
// 核心数据适配层：把原先的 Mock 函数全部导向真正的 Supabase
// ==========================================

// 1. 获取所有账单
export const getBills = async (): Promise<Bill[]> => {
  const { data, error } = await supabase
    .from('bills') // 如果你的表名是 expenses，请把它改成 'expenses'
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error("获取账单失败:", error);
    return [];
  }
  return data || [];
};

// 2. 添加新账单
export const addBill = async (bill: Omit<Bill, 'id' | 'created_at'>): Promise<Bill | null> => {
  const { data, error } = await supabase
    .from('bills') // 如果你的表名是 expenses，请把它改成 'expenses'
    .insert([bill])
    .select()
    .single();

  if (error) {
    console.error("添加账单失败:", error);
    return null;
  }
  return data;
};

// 3. 获取所有用户/室友信息
export const getUserProfiles = async (): Promise<UserProfile[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*');
  
  if (error) {
    console.error("获取用户失败:", error);
    return [];
  }
  return data || [];
};

// 4. 获取付款记录
export const getPayments = async (): Promise<Payment[]> => {
  const { data, error } = await supabase
    .from('payments')
    .select('*');
  
  if (error) {
    console.error("获取付款记录失败:", error);
    return [];
  }
  return data || [];
};

// 5. 添加/更新付款记录
export const recordPayment = async (payment: Omit<Payment, 'id' | 'created_at'>): Promise<Payment | null> => {
  const { data, error } = await supabase
    .from('payments')
    .insert([payment])
    .select()
    .single();

  if (error) {
    console.error("记录付款失败:", error);
    return null;
  }
  return data;
};

// 模拟的高仿查询对象（防止外部有地方残留调用报错）
class MockQueryBuilder {
  private table: string;
  constructor(table: string) { this.table = table; }
  single() { return this; }
  eq() { return this; }
  order() { return this; }
  select() { return this; }
  insert() { return this; }
  update() { return this; }
  delete() { return this; }
  async execute() {
    if (this.table === 'bills') return getBills();
    if (this.table === 'profiles') return getUserProfiles();
    if (this.table === 'payments') return getPayments();
    return [];
  }
}

export const from = (table: string) => new MockQueryBuilder(table);
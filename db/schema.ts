import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const users=sqliteTable('users',{id:text('id').primaryKey(),username:text('username').notNull().unique(),name:text('name').notNull(),role:text('role').notNull(),roles:text('roles'),hash:text('hash').notNull(),salt:text('salt').notNull()});
export const sessions=sqliteTable('sessions',{id:text('id').primaryKey(),userId:text('user_id').notNull(),expires:integer('expires').notNull()});
export const orders=sqliteTable('orders',{id:text('id').primaryKey(),creator:text('creator').notNull(),status:text('status').notNull(),data:text('data').notNull(),version:integer('version').notNull().default(0)});
export const cases=sqliteTable('cases',{id:text('id').primaryKey(),creator:text('creator').notNull(),data:text('data').notNull()});
export const attempts=sqliteTable('attempts',{id:text('id').primaryKey(),count:integer('count').notNull(),until:integer('until').notNull()});

export const expenses=sqliteTable('expenses',{id:text('id').primaryKey(),date:text('date').notNull(),data:text('data').notNull(),creator:text('creator').notNull(),created:text('created').notNull(),voided:integer('voided').notNull().default(0),importKey:text('import_key').unique()});
export const salaries=sqliteTable('salaries',{id:text('id').primaryKey(),date:text('date').notNull(),data:text('data').notNull(),creator:text('creator').notNull(),created:text('created').notNull(),voided:integer('voided').notNull().default(0)});

export const changeRequests=sqliteTable('change_requests',{id:text('id').primaryKey(),orderId:text('order_id').notNull(),requesterId:text('requester_id').notNull(),status:text('status').notNull(),data:text('data').notNull(),pendingKey:text('pending_key').unique()});
export const productTypes=sqliteTable('product_types',{name:text('name').primaryKey(),proofRequired:integer('proof_required').notNull().default(1)});

import {sqliteTable,text,integer,primaryKey} from 'drizzle-orm/sqlite-core';
export const tastings=sqliteTable('tastings',{id:text('id').primaryKey(),owner:text('owner').notNull(),status:text('status').notNull(),title:text('title').notNull(),date:text('date').notNull(),data:text('data').notNull(),token:text('token').notNull(),version:integer('version').notNull().default(1)});
export const members=sqliteTable('members',{session:text('session').notNull(),user:text('user').notNull(),name:text('name').notNull(),paid:integer('paid').notNull().default(0) },t=>[primaryKey({columns:[t.session,t.user]})]);
export const ratings=sqliteTable('ratings',{session:text('session').notNull(),user:text('user').notNull(),sample:text('sample').notNull(),data:text('data').notNull()},t=>[primaryKey({columns:[t.session,t.user,t.sample]})]);

export const historical=sqliteTable('historical',{id:text('id').primaryKey(),data:text('data').notNull()});

// Club membership. `user` is the verified identity from the auth provider (Clerk user ID or gateway user ID).
export const profiles=sqliteTable('profiles',{user:text('user').primaryKey(),name:text('name').notNull(),email:text('email').notNull().default(''),role:text('role').notNull().default('member'),status:text('status').notNull().default('active'),bio:text('bio').notNull().default(''),historyNames:text('history_names').notNull().default('[]'),avatarVersion:integer('avatar_version').notNull().default(0),swish:text('swish').notNull().default(''),createdAt:text('created_at').notNull()});
export const avatars=sqliteTable('avatars',{user:text('user').primaryKey(),mime:text('mime').notNull(),data:text('data').notNull()});
// Personal shopping list on the profile, so it follows the member between devices.
export const shoppingItems=sqliteTable('shopping_items',{user:text('user').notNull(),key:text('key').notNull(),data:text('data').notNull(),createdAt:text('created_at').notNull()},t=>[primaryKey({columns:[t.user,t.key]})]);
// Members the admin has prepared before they first sign in: name, archive names and photo,
// applied when someone signs in with this verified email (lib/pending.ts).
export const pendingProfiles=sqliteTable('pending_profiles',{email:text('email').primaryKey(),name:text('name').notNull(),historyNames:text('history_names').notNull().default('[]'),mime:text('mime').notNull().default(''),avatar:text('avatar').notNull().default(''),createdAt:text('created_at').notNull()});

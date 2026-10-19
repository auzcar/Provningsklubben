import {sqliteTable,text,integer,primaryKey} from 'drizzle-orm/sqlite-core';
export const tastings=sqliteTable('tastings',{id:text('id').primaryKey(),owner:text('owner').notNull(),status:text('status').notNull(),title:text('title').notNull(),date:text('date').notNull(),data:text('data').notNull(),token:text('token').notNull(),version:integer('version').notNull().default(1)});
export const members=sqliteTable('members',{session:text('session').notNull(),user:text('user').notNull(),name:text('name').notNull() },t=>[primaryKey({columns:[t.session,t.user]})]);
export const ratings=sqliteTable('ratings',{session:text('session').notNull(),user:text('user').notNull(),sample:text('sample').notNull(),data:text('data').notNull()},t=>[primaryKey({columns:[t.session,t.user,t.sample]})]);

export const historical=sqliteTable('historical',{id:text('id').primaryKey(),data:text('data').notNull()});

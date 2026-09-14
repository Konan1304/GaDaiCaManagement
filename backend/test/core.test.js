const test=require('node:test'),assert=require('node:assert/strict');const {TIME_ZONE,dateKey,parts}=require('../utils/vietnamTime');
test('hệ thống cố định múi giờ Việt Nam',()=>assert.equal(TIME_ZONE,'Asia/Ho_Chi_Minh'));
test('UTC được đổi đúng sang ngày giờ Việt Nam',()=>{assert.equal(dateKey('2026-09-09T18:30:00Z'),'2026-09-10');const p=parts('2026-09-09T18:30:00Z');assert.equal(p.hour,'01');assert.equal(p.minute,'30')});
test('ranh giới trước nửa đêm Việt Nam không đổi ngày sớm',()=>assert.equal(dateKey('2026-09-09T16:59:59Z'),'2026-09-09'));

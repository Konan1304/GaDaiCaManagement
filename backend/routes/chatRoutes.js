const r=require('express').Router(),auth=require('../middleware/authMiddleware'),roles=require('../middleware/roleMiddleware'),upload=require('../middleware/businessFileUpload'),c=require('../controllers/chatController');
r.use(auth,roles('employee','manager','admin'));
r.get('/channels',c.channels);r.post('/channels',c.createChannel);r.put('/channels/:id',c.updateChannel);r.delete('/channels/:id',c.removeChannel);
r.get('/channels/:id/members',c.members);r.put('/channels/:id/members',c.saveMembers);
r.get('/channels/:id/messages',c.messages);r.post('/channels/:id/messages',upload.single('file'),c.send);r.put('/channels/:id/read',c.read);
r.get('/attachments/:attachmentId',c.download);r.delete('/messages/:id',c.remove);
module.exports=r;

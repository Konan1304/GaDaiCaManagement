const r=require('express').Router(),auth=require('../middleware/authMiddleware'),roles=require('../middleware/roleMiddleware'),upload=require('../middleware/businessFileUpload'),c=require('../controllers/branchReportController');
r.use(auth,roles('employee','manager','admin'));
r.get('/',c.list);r.get('/export.xlsx',c.exportExcel);r.get('/export.pdf',c.exportPdf);r.post('/',upload.single('image'),c.create);
r.put('/:id',upload.single('image'),c.update);r.put('/:id/review',c.review);r.get('/:id/history',c.history);r.get('/attachments/:attachmentId',c.download);
module.exports=r;

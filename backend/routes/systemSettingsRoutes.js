const router=require('express').Router(),auth=require('../middleware/authMiddleware'),roles=require('../middleware/roleMiddleware'),controller=require('../controllers/systemSettingsController');
router.use(auth,roles('admin'));
router.get('/',controller.get);
router.put('/',controller.update);
router.get('/audit-logs',controller.auditLogs);
module.exports=router;

const router=require('express').Router(),auth=require('../middleware/authMiddleware'),roles=require('../middleware/roleMiddleware'),controller=require('../controllers/branchReportController');
router.use(auth,roles('employee','manager','admin'));
router.get('/',controller.list);
router.post('/',controller.create);
router.put('/:id/review',controller.review);
module.exports=router;

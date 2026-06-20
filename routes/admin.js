var express = require('express');
var router = express.Router();

/* GET admin management page. */
router.get('/admin', function(req, res) {
  if (!req.session.user) { return res.redirect('/'); }
  res.render('admin', { title: 'Admin Interface' });
});

module.exports = router;

const express = require('express');
const router = express.Router();

// NOTE: Replace these stub implementations with real Stripe integration when ready.
// See: https://stripe.com/docs/api/checkout/sessions

// POST /api/payments/create-checkout-session
router.post('/create-checkout-session', async (req, res, next) => {
  try {
    const { tier, userId } = req.body;

    if (!tier || !userId) {
      return res.status(400).json({
        error: 'Missing required fields: tier and userId',
        code: 'BAD_REQUEST'
      });
    }

    // TODO: Create real Stripe checkout session
    // const session = await stripe.checkout.sessions.create({
    //   customer_email: req.body.email,
    //   line_items: [{
    //     price: tier === 'pro' ? 'price_xxx' : 'price_yyy',
    //     quantity: 1,
    //   }],
    //   mode: 'subscription',
    //   success_url: `${process.env.FRONTEND_URL}/pricing?success=true`,
    //   cancel_url: `${process.env.FRONTEND_URL}/pricing?canceled=true`,
    // });

    // Mock response for development
    const mockSessionId = `cs_test_${Date.now()}_${userId}`;
    const mockCheckoutUrl = `https://checkout.stripe.com/pay/${mockSessionId}`;

    res.json({
      sessionId: mockSessionId,
      checkoutUrl: mockCheckoutUrl,
      tier
    });

    console.log(`Mock checkout session created for user ${userId}, tier: ${tier}`);
  } catch (error) {
    next(error);
  }
});

// POST /api/payments/verify
router.post('/verify', async (req, res, next) => {
  try {
    const { sessionId, userId } = req.body;

    if (!sessionId || !userId) {
      return res.status(400).json({
        error: 'Missing required fields: sessionId and userId',
        code: 'BAD_REQUEST'
      });
    }

    // TODO: Verify real Stripe session and retrieve subscription
    // const session = await stripe.checkout.sessions.retrieve(sessionId);
    // const subscription = await stripe.subscriptions.retrieve(session.subscription);

    // Mock response for development
    const mockSubscription = {
      tier: 'pro',
      status: 'active',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancelAtPeriodEnd: false
    };

    res.json({
      success: true,
      subscription: mockSubscription
    });

    console.log(`Mock subscription verified for user ${userId}`);
  } catch (error) {
    next(error);
  }
});

// GET /api/payments/subscription/:userId
router.get('/subscription/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;

    // TODO: Fetch real subscription from Stripe
    // const subscriptions = await stripe.subscriptions.list({
    //   customer: customerId,
    //   status: 'active',
    //   limit: 1
    // });

    // Mock response - return free tier if no subscription found
    res.json({
      subscription: {
        tier: 'free',
        status: 'active',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

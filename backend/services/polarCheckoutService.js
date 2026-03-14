import {Polar} from '@polar-sh/sdk';

export const polarClient = new Polar({
  accessToken: process.env.POLAR_SANDBOX_TOKEN, // sandbox token
  server: "sandbox" // important while testing
});

export const createCheckoutSession = async ({ productId, user }) => {
    console.log('User is ', user);
    const checkout = await polarClient.checkouts.create({
        products: [
        productId
        ], // your Polar product ID
        successUrl: `${process.env.FRONTEND_URL}/dashboard?pay_status=payment-success`,
        cancelUrl: `${process.env.FRONTEND_URL}/dashboard?pay_status=payment-cancel`,
        customerName: user.name,
        customerEmail: user.email,
        externalCustomerId: user._id.toString(),
        metadata: {
        userId: user._id.toString(), // 🔥 critical for webhook mapping
        email: user.email
        }
    });

    return checkout.url; // this is the hosted checkout link
};
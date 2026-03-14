import { createCheckoutSession } from '../services/polarCheckoutService.js';

export const getPolarCheckoutLink = async (req, res) => {
    try{
        const user = req.user; // from auth middleware
        const productId = process.env.POLAR_PRODUCT_ID;

        const checkoutUrl = await createCheckoutSession({
        productId,
        user
        });

        res.status(200).json({ url: checkoutUrl });
    } catch (error) {
        console.error('Error generating Polar checkout link:', error);
        res.status(500).json({ message: 'Error generating Polar checkout link' });
    }
}
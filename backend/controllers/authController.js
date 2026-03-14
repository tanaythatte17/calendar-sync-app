import { 
  signup as signupService, 
  login as loginService, 
  logout as logoutService, 
  getMe as getMeService, 
  forgotPasswordService, 
  verifyOTPService, 
  setNewPasswordService,
  getGoogleAuthURLService,
  handleGoogleCallbackService,
  getMicrosoftAuthURLService,
  handleMicrosoftCallbackService
} from "../services/authService.js";

export const signup = async (req,res) => {
    try{
        const {name,email,password,confirmPassword} = req.body;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: "Invalid email format" });
        }
        if(password !== confirmPassword){
            return res.status(400).json({error:"Passwords don't match"});
        }
        const result = await signupService(res, { name, email, password });
        return res.status(201).json(result);
    }
    catch(error){
        console.log(error.message);
        const status = error.statusCode || 400;
        return res.status(status).json({error: error.message || "Internal error in creating user"});
    }
}
export const login = async (req,res) => {
    try {
        const {email,password} = req.body;
        const result = await loginService(res, { email, password });
        return res.status(200).json(result);
    } catch (error) {
        console.log(error.message);
        const status = error.statusCode || 400;
        res.status(status).json({error: error.message || "Internal error"});
    }
}
export const logout = (req,res) => {
    try {
        const result = logoutService(res);
        res.status(200).json(result);
    } catch (error) {
        console.log(error.message);
        res.status(400).json({error:"Internal error"});
    }
}

// Returns the authenticated user's data
export const getMe = (req, res) => {
    try{
        const result = getMeService(req.user);
        res.status(200).json(result);
    } catch(error){
        const status = error.statusCode || 400;
        res.status(status).json({ error: error.message || "Error" });
    }
};

export const forgotPassword = async (req, res) => {
    try {
        const {email} = req.body;
        const result = await forgotPasswordService(email);
        res.status(200).json(result);
    } catch(error){
        const status = error.statusCode || 400;
        res.status(status).json({ error: error.message || "Error" });
    }
}

export const verifyOTP = async (req, res) => {
    try {
        const {email, otp} = req.body;
        const result = await verifyOTPService(email, otp);
        res.status(200).json(result);
    } catch(error){
        const status = error.statusCode || 400;
        res.status(status).json({ error: error.message || "Error" });
    }
}

export const setNewPassword = async (req, res) => {
    try{
        const {email, newPassword, confirmNewPassword, resetToken} = req.body;
        const result = await setNewPasswordService(email, newPassword, confirmNewPassword, resetToken);
        res.status(200).json(result);
    } catch(error){
        const status = error.statusCode || 400;
        res.status(status).json({ error: error.message || "Error" });
    }
}

export const getGoogleAuthURL = async (req, res) => {
  try {
    const result = await getGoogleAuthURLService();
    res.status(200).json(result);
  } catch (error) {
    console.error('Error generating Google auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
};

export const handleGoogleCallback = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_code`);
    }

    const result = await handleGoogleCallbackService(code, res);

    // Redirect to frontend success page
    res.redirect(`${process.env.FRONTEND_URL}/auth/success`);

  } catch (error) {
    console.error('Google callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
  }
};

export const getMicrosoftAuthURL = async (req, res) => {
  try {
    const result = await getMicrosoftAuthURLService();
    res.status(200).json(result);
  } catch (error) {
    console.error('Error generating Microsoft auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
};

export const handleMicrosoftCallback = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_code`);
    }

    const result = await handleMicrosoftCallbackService(code, res);

    // Redirect to frontend success page
    res.redirect(`${process.env.FRONTEND_URL}/auth/success`);

  } catch (error) {
    console.error('Microsoft callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
  }
};
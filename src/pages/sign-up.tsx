import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../api/firebase/config';
import { User, SubscriptionType, SubscriptionPlatform, UserLevel } from '../api/firebase/user';
import { userService } from '../api/firebase/user';
import { firebaseStorageService } from '../api/firebase/storage/service';
import { Camera, Eye, EyeOff, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { FaGoogle, FaApple } from 'react-icons/fa';

const SignUpPage: React.FC = () => {
  const router = useRouter();
  const { type } = router.query; // Get the type parameter (e.g., 'coach')
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: ''
  });
  
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    username?: string;
  }>({});

  const isCoachSignUp = type === 'coach';

  // Clear error when user starts typing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
    
    // Clear specific field error
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImage(file);
      setProfileImagePreview(URL.createObjectURL(file));
    }
  };

  const validateForm = () => {
    const newErrors: typeof errors = {};
    
    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    // Username validation
    if (!formData.username) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );
      
      const firebaseUser = userCredential.user;
      
      // Upload profile image if provided
      let profileImageData = null;
      if (profileImage) {
        setIsImageUploading(true);
        try {
          // Upload directly to profile_images/{uid}/...
          const storagePath = `profile_images/${firebaseUser.uid}/${Date.now()}_${profileImage.name}`;
          const { downloadURL } = await firebaseStorageService.uploadFileToStorage(
            profileImage,
            storagePath
          );
          profileImageData = {
            profileImageURL: downloadURL,
            imageOffsetWidth: 0,
            imageOffsetHeight: 0
          };
        } catch (imageError) {
          console.error('Error uploading profile image:', imageError);
          // Continue without image rather than failing the whole signup
        } finally {
          setIsImageUploading(false);
        }
      }
      
      // Create Firestore user document
      const userData = {
        id: firebaseUser.uid,
        email: formData.email,
        username: formData.username,
        displayName: formData.username, // Use username as display name initially
        role: isCoachSignUp ? 'coach' : 'athlete',
        registrationComplete: true, // Mark as complete since we're keeping it simple
        subscriptionType: SubscriptionType.unsubscribed,
        subscriptionPlatform: SubscriptionPlatform.Web,
        level: UserLevel.Novice,
        goal: [],
        bodyWeight: [],
        macros: {},
        profileImage: profileImageData || {
          profileImageURL: '',
          imageOffsetWidth: 0,
          imageOffsetHeight: 0
        },
        bio: '',
        additionalGoals: '',
        blockedUsers: [],
        encouragement: [],
        isCurrentlyActive: false,
        videoCount: 0,
        creator: null,
        winner: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Create User instance and save to Firestore
      const user = new User(firebaseUser.uid, userData);
      await userService.updateUser(firebaseUser.uid, user);
      
      setSuccess(true);
      
      // Redirect after success
      setTimeout(() => {
        if (isCoachSignUp) {
          router.push('/coach/dashboard');
        } else {
          router.push('/dashboard');
        }
      }, 2000);
      
    } catch (error: any) {
      console.error('Sign up error:', error);
      
      // Handle specific Firebase errors
      if (error.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Please sign in instead.');
      } else if (error.code === 'auth/weak-password') {
        setError('Password is too weak. Please choose a stronger password.');
      } else if (error.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError('Failed to create account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Head>
          <title>{isCoachSignUp ? 'Coach' : 'User'} Registration Success | Pulse</title>
        </Head>
        <div className="text-center max-w-md mx-auto p-8">
          <CheckCircle className="text-[#E0FE10] text-6xl mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-white mb-4">Welcome to Pulse!</h1>
          <p className="text-zinc-300 mb-6">
            {isCoachSignUp 
              ? "Your coach account has been created successfully. You'll be redirected to your dashboard shortly."
              : "Your account has been created successfully. You'll be redirected to your dashboard shortly."
            }
          </p>
          <div className="bg-zinc-900 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-[#E0FE10] rounded-full flex items-center justify-center">
                <span className="text-black font-bold text-lg">
                  {formData.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="text-left">
                <div className="text-white font-medium">@{formData.username}</div>
                <div className="text-zinc-400 text-sm">
                  {isCoachSignUp ? 'Coach' : 'Athlete'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Head>
        <title>{isCoachSignUp ? 'Coach' : 'User'} Sign Up | Pulse</title>
        <meta name="description" content={`Create your ${isCoachSignUp ? 'coach' : 'user'} account on Pulse`} />
      </Head>
      
      <div className="max-w-md mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#E0FE10] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-black font-bold text-2xl">P</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {isCoachSignUp ? 'Join as a Coach' : 'Join Pulse'}
          </h1>
          <p className="text-zinc-400">
            {isCoachSignUp 
              ? 'Create your coach account in seconds'
              : 'Create your account in seconds'
            }
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Image */}
          <div className="text-center">
            <div className="relative inline-block">
              <div className="w-24 h-24 bg-zinc-800 rounded-full flex items-center justify-center overflow-hidden border-2 border-zinc-700">
                {profileImagePreview ? (
                  <img 
                    src={profileImagePreview} 
                    alt="Profile preview" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Camera className="text-zinc-500 text-2xl" />
                )}
              </div>
              <label 
                htmlFor="profileImage" 
                className="absolute -bottom-2 -right-2 bg-[#E0FE10] text-black p-2 rounded-full cursor-pointer hover:bg-lime-400 transition-colors"
              >
                <Camera size={16} />
                <input
                  id="profileImage"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-zinc-500 text-sm mt-2">Optional profile photo</p>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-2">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              className={`w-full bg-zinc-900 border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#E0FE10] transition ${
                errors.email ? 'border-red-500' : 'border-zinc-700'
              }`}
              placeholder="your@email.com"
            />
            {errors.email && (
              <p className="text-red-400 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          {/* Username */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-zinc-300 mb-2">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              value={formData.username}
              onChange={handleInputChange}
              className={`w-full bg-zinc-900 border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#E0FE10] transition ${
                errors.username ? 'border-red-500' : 'border-zinc-700'
              }`}
              placeholder="your_username"
            />
            {errors.username && (
              <p className="text-red-400 text-sm mt-1">{errors.username}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleInputChange}
                className={`w-full bg-zinc-900 border rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-[#E0FE10] transition ${
                  errors.password ? 'border-red-500' : 'border-zinc-700'
                }`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-400 text-sm mt-1">{errors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-300 mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={`w-full bg-zinc-900 border rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-[#E0FE10] transition ${
                  errors.confirmPassword ? 'border-red-500' : 'border-zinc-700'
                }`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-red-400 text-sm mt-1">{errors.confirmPassword}</p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 flex items-center">
              <AlertTriangle className="text-red-400 mr-2" size={20} />
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || isImageUploading}
            className="w-full bg-[#E0FE10] text-black font-semibold py-3 rounded-lg hover:bg-lime-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin mr-2" size={20} />
                Creating Account...
              </>
            ) : isImageUploading ? (
              <>
                <Loader2 className="animate-spin mr-2" size={20} />
                Uploading Image...
              </>
            ) : (
              `Create ${isCoachSignUp ? 'Coach' : ''} Account`
            )}
          </button>
        </form>

        {/* Sign In Link */}
        <div className="text-center mt-6">
          <p className="text-zinc-400">
            Already have an account?{' '}
            <button
              onClick={() => router.push('/')}
              className="text-[#E0FE10] hover:text-lime-400 transition-colors"
            >
              Sign in
            </button>
          </p>
        </div>

        {/* Coach-specific note */}
        {isCoachSignUp && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 mt-6">
            <h3 className="text-[#E0FE10] font-semibold mb-2">Coach Account Benefits</h3>
            <ul className="text-zinc-300 text-sm space-y-1">
              <li>• Access to PulseCheck AI coaching tools</li>
              <li>• Advanced client management dashboard</li>
              <li>• Performance analytics and insights</li>
              <li>• Connect with athletes and track progress</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignUpPage;

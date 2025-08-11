"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Github,
  Chrome,
  Check,
} from "lucide-react";
import Link from "next/link";

export function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => setIsLoading(false), 2000);
  };

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-teal-800 to-green-600 bg-clip-text text-transparent">
          Create your account
        </h2>
        <p className="mt-2 text-gray-600">
          Join thousands of creators and start collaborating today
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium text-gray-700">
              Full name
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                className="pl-10 h-12 border-gray-200 focus:border-none focus:ring-none"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="text-sm font-medium text-gray-700"
            >
              Email address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                className="pl-10 h-12 border-gray-200 focus:border-none focus:ring-none"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-sm font-medium text-gray-700"
            >
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a password"
                className="pl-10 pr-10 h-12 border-gray-200 focus:border-none focus:ring-none"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="confirmPassword"
              className="text-sm font-medium text-gray-700"
            >
              Confirm password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                className="pl-10 pr-10 h-12 border-gray-200 focus:border-none focus:ring-none"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* <div className="flex items-start space-x-3">
          <div className="flex items-center h-5">
            <button
              type="button"
              onClick={() => setAgreedToTerms(!agreedToTerms)}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                agreedToTerms
                  ? "bg-green-600 border-green-600"
                  : "border-gray-300 hover:border-green-400"
              }`}
            >
              {agreedToTerms && <Check className="w-3 h-3 text-white" />}
            </button>
          </div>
          <div className="text-sm leading-5">
            <span className="text-gray-700">
              I agree to the{" "}
              <Link
                href="/terms"
                className="text-teal-600 hover:text-teal-500 font-medium"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="text-teal-600 hover:text-teal-500 font-medium"
              >
                Privacy Policy
              </Link>
            </span>
          </div>
        </div> */}

        <Button
          type="submit"
          className="w-full h-12 bg-gradient-to-r  from-green-500 via-green-700 to-teal-800 hover:from-green-600 hover:via-green-700 hover:to-teal-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          disabled={isLoading || agreedToTerms}
        >
          {isLoading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <div className="relative">
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">Or continue with</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="fam"
          className="h-12 border border-gray-400 hover:bg-gray-50"
        >
          <Github className="w-5 h-5 mr-2" />
          GitHub
        </Button>
        <Button
          variant="fam"
          className="h-12 border border-gray-400 hover:bg-gray-50"
        >
          <Chrome className="w-5 h-5 mr-2" />
          Google
        </Button>
      </div>

      <p className="text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link
          href="/signin"
          className="font-medium text-teal-600 hover:text-teal-800"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

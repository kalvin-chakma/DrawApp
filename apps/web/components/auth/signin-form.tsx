"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

import { Eye, EyeOff, Mail, Lock, Github, Chrome } from "lucide-react";
import Link from "next/link";

export function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
          Welcome back
        </h2>
        <p className="mt-2 text-gray-600">
          Sign in to your account to continue creating
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
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
                placeholder="Enter your password"
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
        </div>

        <div className="flex items-center justify-end">
          <Link
            href="/forgot-password"
            className="text-sm text-teal-600 hover:text-teal-800 font-medium"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          className="w-full h-12 bg-gradient-to-r from-green-500 via-green-700 to-teal-800 hover:from-green-600 hover:via-green-700 hover:to-teal-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-[1.02]"
          disabled={isLoading}
        >
          {isLoading ? "Signing in..." : "Sign in"}
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
        Don't have an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-teal-600 hover:text-teal-700"
        >
          Sign up for free
        </Link>
      </p>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Eye, EyeOff, Mail, Lock, User, Github, Chrome } from "lucide-react";
import Link from "next/link";
import { signup } from "../../services/api";

export function SignUpForm() {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const rules = [
    { rule: /(?=.*[a-z])(?=.*[A-Z])/, label: "Upper & lowercase required" },
    { rule: /.{7,}/, label: "Min 7 characters required" },
    { rule: /(?=.*\d)/, label: "At least 1 number required" },
  ];

  const isPasswordValid = rules.every((r) => r.rule.test(form.password));

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);
    setError("");
    setSuccess("");

    const { name, email, password, confirmPassword } = form;

    if (!name || !email || !password || !confirmPassword) {
      setError("Please fill in all the fields");
      setIsLoading(false);
      return;
    }

    if (!isPasswordValid) {
      setError("Please ensure password meets requirements");
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const response = await signup({
        username: email,
        name,
        password,
      });

      if (response.status !== 200) {
        throw new Error("Signup failed");
      }

      setSuccess("Account created successfully");

      setForm({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
      });

      router.push("/signin");
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "response" in err) {
        const errorObj = err as any;
        setError(
          errorObj.response?.data?.message ||
            "Something went wrong. Please try again.",
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
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

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              id="name"
              type="text"
              value={form.name}
              autoComplete="name"
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Enter your full name"
              className="pl-10 h-12"
              required
            />
          </div>

          <Label htmlFor="email">Email address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="Enter your email"
              className="pl-10 h-12"
              required
            />
          </div>

          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              id="password"
              autoComplete="new-password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => handleChange("password", e.target.value)}
              placeholder="Create a password"
              className="pl-10 pr-10 h-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>

          <Label htmlFor="confirmPassword">Confirm password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              id="confirmPassword"
              autoComplete="new-password"
              type={showConfirmPassword ? "text" : "password"}
              value={form.confirmPassword}
              onChange={(e) => handleChange("confirmPassword", e.target.value)}
              placeholder="Confirm your password"
              className="pl-10 pr-10 h-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {showConfirmPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div className="space-y-1 text-sm ml-2">
          {rules.map(({ rule, label }, i) => {
            const valid = rule.test(form.password);
            return (
              <div key={i} className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    valid ? "bg-green-600" : "bg-gray-600"
                  }`}
                />
                <span className={valid ? "text-green-600" : "text-gray-600"}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        <Button
          type="submit"
          className="w-full h-12 bg-gradient-to-r from-green-500 via-green-700 to-teal-800 text-white font-medium rounded-lg hover:scale-[1.02] transition-all duration-200"
          disabled={
            isLoading ||
            !isPasswordValid ||
            form.password !== form.confirmPassword
          }
        >
          {isLoading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <div className="relative text-sm text-center text-gray-500">
        <span className="px-2 bg-white">Or continue with</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="fam"
          className="h-12 border border-gray-400 hover:bg-gray-50"
        >
          <Github className="w-5 h-5 mr-2" /> GitHub
        </Button>
        <Button
          variant="fam"
          className="h-12 border border-gray-400 hover:bg-gray-50"
        >
          <Chrome className="w-5 h-5 mr-2" /> Google
        </Button>
      </div>

      <p className="text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link
          href="/signin"
          className="text-teal-600 hover:text-teal-800 font-medium"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

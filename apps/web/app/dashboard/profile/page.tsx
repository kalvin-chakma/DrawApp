"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, ImageIcon, AlertCircle, CheckCircle2 } from "lucide-react";
import { getCurrentUser, updateProfile } from "../../../services/api";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

interface Profile {
  id: string;
  name: string;
  email: string;
  photo: string | null;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getCurrentUser();
      setProfile(res.data);
      setName(res.data.name ?? "");
      setPhoto(res.data.photo ?? "");
    } catch (err: any) {
      if (err?.response?.status === 401) {
        router.push("/signin");
        return;
      }
      setError("Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/signin");
      return;
    }
    fetchProfile();
  }, [fetchProfile, router]);

  const initials = (name || profile?.email || "?")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name cannot be empty.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await updateProfile({
        name: trimmedName,
        photo: photo.trim(),
      });
      setProfile(res.data);
      setSuccess("Profile updated successfully.");
    } catch (err: any) {
      if (err?.response?.status === 401) {
        router.push("/signin");
        return;
      }
      const status = err?.response?.status;
      if (status === 400) {
        setError("Please check your input — the photo must be a valid URL.");
      } else {
        setError("Failed to update profile. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const isDirty =
    profile !== null &&
    (name.trim() !== profile.name || photo.trim() !== (profile.photo ?? ""));

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <User className="w-4 h-4" />
          <h1 className="text-md font-semibold">Profile</h1>
        </div>
        <p className="text-2xl text-black font-bold mt-0.5">
          Your account details
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
          <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6">
          {/* Avatar preview */}
          <div className="flex items-center gap-4">
            {photo.trim() ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo.trim()}
                alt="Profile photo"
                className="w-16 h-16 rounded-full object-cover border border-gray-100"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-600 to-green-600 flex items-center justify-center text-white text-lg font-semibold flex-shrink-0">
                {initials}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {profile?.name}
              </p>
              <p className="text-xs text-gray-500">{profile?.email}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError("");
                    if (success) setSuccess("");
                  }}
                  placeholder="Enter your full name"
                  className="pl-10 h-11"
                  disabled={saving}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  value={profile?.email ?? ""}
                  className="pl-10 h-11 bg-gray-50 text-gray-500"
                  disabled
                  readOnly
                />
              </div>
              <p className="text-xs text-gray-400">
                Email addresses can&apos;t be changed.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="photo">Photo URL</Label>
              <div className="relative">
                <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="photo"
                  type="url"
                  value={photo}
                  onChange={(e) => {
                    setPhoto(e.target.value);
                    if (error) setError("");
                    if (success) setSuccess("");
                  }}
                  placeholder="https://example.com/avatar.jpg"
                  className="pl-10 h-11"
                  disabled={saving}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                {success}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                variant="gradient"
                disabled={saving || !isDirty || !name.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-medium"
              >
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

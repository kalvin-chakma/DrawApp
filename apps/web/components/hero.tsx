"use client";

import { Button } from "@repo/ui/components/button";
import { ArrowRight, Sparkles, Users, Zap } from "lucide-react";

export function Hero() {
  return (
    <section className="relative min-h-screen w-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-teal-50 to-green-50">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden ">
        <div className="absolute -top-40 -right-32 w-96 h-96 bg-gradient-to-br from-teal-400 to-green-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-32 w-96 h-96 bg-gradient-to-br from-green-400 to-teal-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-teal-300 to-green-300 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse delay-500"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 mt-10 lg:mt-0 bg-white/80 backdrop-blur-sm rounded-full border border-teal-200/50 shadow-lg">
            <Sparkles className="w-4 h-4 text-teal-600" />
            <span className="text-sm font-medium text-gray-700">
              The future of collaborative drawing
            </span>
          </div>

          {/* Main headline */}
          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-teal-900 via-teal-800 to-green-600 bg-clip-text text-transparent leading-tight">
              Draw. Collaborate.
              <br />
              <span className="bg-gradient-to-r from-teal-600 to-green-600 bg-clip-text text-transparent">
                Create Together.
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
              The intuitive whiteboard tool that brings teams together. Create
              diagrams, wireframes, and visual ideas in real-time with anyone,
              anywhere.
            </p>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <Button
              variant="gradient"
              className="group transition-all duration-300"
            >
              Start Drawing Free
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              variant="fam"
              className="h-14 rounded-lg px-10 text-lg bg-white/80 backdrop-blur-sm hover:bg-white border-gray-200 hover:border-gray-300"
            >
              Watch Demo
            </Button>
          </div>

          {/* Stats */}
          <div className="flex flex-col sm:flex-row gap-8 justify-center items-center pt-16 text-gray-600">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-600" />
              <span className="font-semibold text-gray-900">creators</span>
              <span>around the world</span>
            </div>
            <div className="hidden sm:block w-px h-6 bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-gray-900">Real-time</span>
              <span>collaboration</span>
            </div>
            <div className="hidden sm:block w-px h-6 bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-600" />
              <span className="font-semibold text-gray-900">100%</span>
              <span>free to start</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating elements */}
      <div className="absolute top-20 left-10 w-16 h-16 bg-gradient-to-br from-teal-400 to-pink-400 rounded-xl rotate-12 opacity-20 animate-bounce"></div>
      <div className="absolute bottom-20 right-10 w-12 h-12 bg-gradient-to-br from-green-400 to-teal-400 rounded-full opacity-20 animate-bounce delay-300"></div>
      <div className="absolute top-1/2 right-20 w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-lg rotate-45 opacity-20 animate-bounce delay-700"></div>
    </section>
  );
}

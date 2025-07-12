/**
 * TestPage - Simple test page to verify components work
 */
"use client";

import Button from "@/components/atoms/Button/Button";
import Card, { CardContent, CardHeader, CardTitle } from "@/components/atoms/Card/Card";
import CurrencyInput from "@/components/atoms/CurrencyInput/CurrencyInput";
import { useState } from "react";

export default function TestPage() {
  const [amount, setAmount] = useState(0);

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold text-center text-blue-400">
          Test de Componentes - Dark Theme
        </h1>
        
        {/* Test Button */}
        <Card variant="glass" className="p-6">
          <CardHeader>
            <CardTitle className="text-white">Test Button</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 flex-wrap">
              <Button variant="default" className="bg-slate-700 text-white hover:bg-slate-600">Default</Button>
              <Button variant="gradient">Gradient</Button>
              <Button variant="glass">Glass</Button>
              <Button variant="outline" className="text-white border-slate-600 hover:bg-slate-700">Outline</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="secondary" className="bg-slate-700 text-white hover:bg-slate-600">Secondary</Button>
            </div>
          </CardContent>
        </Card>

        {/* Test CurrencyInput */}
        <Card variant="glass" className="p-6">
          <CardHeader>
            <CardTitle className="text-white">Test CurrencyInput</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-white">
                Amount: ${amount.toFixed(2)}
              </label>
              <CurrencyInput 
                value={amount}
                onChange={setAmount}
                placeholder="Enter amount"
                className="bg-slate-800 border-slate-600 text-white placeholder-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-white">
                With Error State
              </label>
              <CurrencyInput 
                value={0}
                onChange={() => {}}
                placeholder="Error input"
                error={true}
                className="bg-slate-800 border-red-500 text-white placeholder-gray-400"
              />
            </div>
          </CardContent>
        </Card>

        {/* Test Card Variants */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card variant="default" className="p-4 bg-slate-800 border-slate-700">
            <CardTitle className="text-white">Default Card</CardTitle>
            <p className="text-sm text-gray-300">This is a default card with dark background</p>
          </Card>
          
          <Card variant="glass" className="p-4">
            <CardTitle className="text-white">Glass Card</CardTitle>
            <p className="text-sm text-gray-300">This is a glass card with transparency</p>
          </Card>
          
          <Card variant="gradient-border" className="p-4">
            <CardTitle className="text-white">Gradient Border</CardTitle>
            <p className="text-sm text-gray-300">This is a gradient border card</p>
          </Card>
        </div>

        {/* Test Form Elements */}
        <Card variant="glass" className="p-6">
          <CardHeader>
            <CardTitle className="text-white">Test Form Elements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  Regular Input
                </label>
                <input 
                  type="text" 
                  placeholder="Type something..."
                  className="w-full px-3 py-2 border border-slate-600 rounded-md text-sm bg-slate-800 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-white">
                  Select Dropdown
                </label>
                <select className="w-full px-3 py-2 border border-slate-600 rounded-md text-sm bg-slate-800 text-white">
                  <option>Option 1</option>
                  <option>Option 2</option>
                  <option>Option 3</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Color Palette */}
        <Card variant="glass" className="p-6">
          <CardHeader>
            <CardTitle className="text-white">Test Color Palette</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="text-blue-400 font-semibold">Blue</div>
                <div className="text-blue-300 text-sm">Primary color</div>
              </div>
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="text-green-400 font-semibold">Green</div>
                <div className="text-green-300 text-sm">Success color</div>
              </div>
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="text-red-400 font-semibold">Red</div>
                <div className="text-red-300 text-sm">Error color</div>
              </div>
              <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <div className="text-purple-400 font-semibold">Purple</div>
                <div className="text-purple-300 text-sm">Accent color</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Loading States */}
        <Card variant="glass" className="p-6">
          <CardHeader>
            <CardTitle className="text-white">Test Loading States</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 flex-wrap">
              <Button variant="gradient" loading>Loading Gradient</Button>
              <Button variant="glass" loading>Loading Glass</Button>
              <Button variant="outline" loading className="text-white border-slate-600">Loading Outline</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 
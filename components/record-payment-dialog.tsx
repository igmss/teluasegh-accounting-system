"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { DollarSign } from "lucide-react"

interface RecordPaymentDialogProps {
  invoice: {
    id: string
    total_amount: number
    status: string
  }
}

export function RecordPaymentDialog({ invoice }: RecordPaymentDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [paymentData, setPaymentData] = useState({
    amount: invoice.total_amount.toString(),
    method: "",
    reference: "",
    notes: "",
    date: new Date().toISOString().split("T")[0],
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Record payment via API
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoice_id: invoice.id,
          amount: Number(paymentData.amount),
          method: paymentData.method,
          reference: paymentData.reference,
          notes: paymentData.notes,
          date: new Date(paymentData.date)
        })
      })

      if (response.ok) {
        // Update invoice status to paid
        const invoiceResponse = await fetch('/api/invoices', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: invoice.id,
            status: "paid",
            paid_at: new Date()
          })
        })

        if (invoiceResponse.ok) {
          alert('Payment recorded successfully! Invoice marked as paid.')
          setIsOpen(false)
          // Refresh the page or trigger a refresh
          window.location.reload()
        } else {
          alert('Payment recorded but failed to update invoice status.')
        }
      } else {
        alert('Failed to record payment. Please try again.')
      }
    } catch (error) {
      console.error('Error recording payment:', error)
      alert('Error recording payment. Please try again.')
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setPaymentData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <DollarSign className="h-4 w-4 mr-2" />
          Record Payment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Payment Amount ($) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              max={invoice.total_amount}
              value={paymentData.amount}
              onChange={(e) => handleInputChange("amount", e.target.value)}
              required
            />
            <div className="text-sm text-muted-foreground">Invoice total: ${invoice.total_amount.toFixed(2)}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="method">Payment Method *</Label>
            <Select value={paymentData.method} onValueChange={(value) => handleInputChange("method", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Payment Date *</Label>
            <Input
              id="date"
              type="date"
              value={paymentData.date}
              onChange={(e) => handleInputChange("date", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">Reference Number</Label>
            <Input
              id="reference"
              value={paymentData.reference}
              onChange={(e) => handleInputChange("reference", e.target.value)}
              placeholder="Check number, transaction ID, etc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={paymentData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              placeholder="Additional payment details..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Record Payment</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

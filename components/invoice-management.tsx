"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Search, FileText, DollarSign, Clock, CheckCircle, Eye, Send, Download } from "lucide-react"
import { InvoiceDetails } from "./invoice-details"
import { CreateInvoiceDialog } from "./create-invoice-dialog"
import { RecordPaymentDialog } from "./record-payment-dialog"
import { formatCurrency } from "@/lib/utils"

export function InvoiceManagement() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filteredInvoices, setFilteredInvoices] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null)

  // Fetch invoices from Firestore
  useEffect(() => {
    async function fetchInvoices() {
      try {
        const response = await fetch('/api/invoices')
        if (!response.ok) {
          throw new Error('Failed to fetch invoices')
        }
        const invoicesData = await response.json()
        setInvoices(invoicesData)
      } catch (error) {
        console.error("Error loading invoices:", error)
        setInvoices([])
      } finally {
        setLoading(false)
      }
    }
    
    fetchInvoices()
  }, [])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/invoices')
        if (response.ok) {
          const invoicesData = await response.json()
          setInvoices(invoicesData)
        }
      } catch (error) {
        console.error('Error refreshing invoices:', error)
      }
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let filtered = invoices

    if (searchTerm) {
      filtered = filtered.filter(
        (invoice) =>
          invoice.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          invoice.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          invoice.sales_order_id.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((invoice) => invoice.status === statusFilter)
    }

    setFilteredInvoices(filtered)
  }, [invoices, searchTerm, statusFilter])

  const getStatusBadge = (status: string, dueDate: any) => {
    if (status === "paid") {
      return <Badge variant="default">Paid</Badge>
    } else if (status === "partial") {
      return <Badge variant="secondary">Partial</Badge>
    } else if (status === "overdue" || (status === "unpaid" && dueDate && new Date() > (dueDate?.toDate ? dueDate.toDate() : new Date(dueDate || new Date())))) {
      return <Badge variant="destructive">Overdue</Badge>
    } else {
      return <Badge variant="outline">Unpaid</Badge>
    }
  }

  const totalInvoiceAmount = invoices.reduce((sum, invoice) => sum + invoice.total_amount, 0)
  const paidAmount = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, invoice) => sum + invoice.total_amount, 0)
  const unpaidAmount = invoices
    .filter((inv) => inv.status === "unpaid" || inv.status === "partial" || inv.status === "overdue")
    .reduce((sum, invoice) => sum + invoice.total_amount, 0)
  const overdueCount = invoices.filter(
    (inv) => inv.status === "overdue" || (inv.status === "unpaid" && inv.due_date && new Date() > (inv.due_date?.toDate ? inv.due_date.toDate() : new Date(inv.due_date || new Date()))),
  ).length

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{formatCurrency(totalInvoiceAmount)}</div>
                <div className="text-sm text-muted-foreground">Total Invoiced</div>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(paidAmount)}</div>
                <div className="text-sm text-muted-foreground">Paid</div>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-orange-600">{formatCurrency(unpaidAmount)}</div>
                <div className="text-sm text-muted-foreground">Outstanding</div>
              </div>
              <DollarSign className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-red-600">{overdueCount}</div>
                <div className="text-sm text-muted-foreground">Overdue</div>
              </div>
              <Clock className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <CardTitle>Invoice Management</CardTitle>
            <CreateInvoiceDialog />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices, customers, or order IDs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-muted rounded w-3/4 mx-auto"></div>
                <div className="h-4 bg-muted rounded w-1/2 mx-auto"></div>
                <div className="h-4 bg-muted rounded w-2/3 mx-auto"></div>
              </div>
              <p className="text-muted-foreground mt-4">Loading invoices...</p>
            </div>
          ) : (
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.id}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{invoice.customer_name}</div>
                      <div className="text-sm text-muted-foreground">Order: {invoice.sales_order_id}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{formatCurrency(invoice.total_amount)}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(invoice.amount)} + {formatCurrency(invoice.tax_amount)} tax
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={new Date() > (invoice.due_date?.toDate ? invoice.due_date.toDate() : new Date(invoice.due_date || new Date())) ? "text-red-600" : ""}>
                      {(invoice.due_date?.toDate ? invoice.due_date.toDate() : new Date(invoice.due_date || new Date())).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(invoice.status, invoice.due_date)}</TableCell>
                  <TableCell>
                    {invoice.created_at 
                      ? (invoice.created_at?.toDate ? invoice.created_at.toDate() : new Date(invoice.created_at || new Date())).toLocaleDateString()
                      : 'N/A'
                    }
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => setSelectedInvoice(invoice)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>Invoice Details</DialogTitle>
                          </DialogHeader>
                          {selectedInvoice && <InvoiceDetails invoice={selectedInvoice} />}
                        </DialogContent>
                      </Dialog>

                      {invoice.status !== "paid" && (
                        <RecordPaymentDialog invoice={invoice} />
                      )}

                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>

                      <Button variant="outline" size="sm">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

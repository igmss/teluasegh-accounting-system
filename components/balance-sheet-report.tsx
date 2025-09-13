"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, Building, DollarSign, TrendingUp } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { useState, useEffect } from "react"

interface BalanceSheetReportProps {
  dateRange: {
    from: string
    to: string
  }
}

// Mock Balance Sheet data
const mockBalanceSheetData = {
  assets: {
    current_assets: {
      cash: 45000,
      accounts_receivable: 32000,
      inventory_raw: 28000,
      inventory_wip: 15000,
      inventory_finished: 22000,
      prepaid_expenses: 5000,
      total_current_assets: 147000,
    },
    fixed_assets: {
      equipment: 125000,
      accumulated_depreciation: -35000,
      building: 200000,
      accumulated_depreciation_building: -45000,
      total_fixed_assets: 245000,
    },
    total_assets: 392000,
  },
  liabilities: {
    current_liabilities: {
      accounts_payable: 18000,
      accrued_expenses: 8000,
      short_term_debt: 12000,
      total_current_liabilities: 38000,
    },
    long_term_liabilities: {
      long_term_debt: 85000,
      total_long_term_liabilities: 85000,
    },
    total_liabilities: 123000,
  },
  equity: {
    retained_earnings: 219000,
    current_earnings: 50000,
    total_equity: 269000,
  },
}

export function BalanceSheetReport({ dateRange }: BalanceSheetReportProps) {
  const [reportData, setReportData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchReportData() {
      try {
        setLoading(true)
        const response = await fetch(`/api/reports/balance-sheet?from=${dateRange.from}&to=${dateRange.to}`)
        if (!response.ok) {
          throw new Error('Failed to fetch balance sheet report')
        }
        const data = await response.json()
        setReportData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    
    fetchReportData()
  }, [dateRange.from, dateRange.to])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Balance Sheet Report</h2>
          <div className="animate-pulse bg-muted h-10 w-32 rounded"></div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-muted h-24 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error || !reportData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Balance Sheet Report</h2>
          <Button disabled>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Error loading report: {error}</p>
        </div>
      </div>
    )
  }

  const currentRatio = reportData.liabilities.current_liabilities.total_current_liabilities > 0 
    ? reportData.assets.current_assets.total_current_assets / reportData.liabilities.current_liabilities.total_current_liabilities 
    : 0
  const debtToEquity = reportData.equity.total_equity > 0 
    ? reportData.liabilities.total_liabilities / reportData.equity.total_equity 
    : 0

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{formatCurrency(reportData.assets.total_assets || 0)}</div>
                <div className="text-sm text-muted-foreground">Total Assets</div>
              </div>
              <Building className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{formatCurrency(reportData.liabilities.total_liabilities)}</div>
                <div className="text-sm text-muted-foreground">Total Liabilities</div>
              </div>
              <DollarSign className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{formatCurrency(reportData.equity.total_equity || 0)}</div>
                <div className="text-sm text-muted-foreground">Total Equity</div>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{currentRatio.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Current Ratio</div>
              </div>
              <div className="text-sm text-green-600">Healthy</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Balance Sheet */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Balance Sheet</CardTitle>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-bold">Manufacturing Company</h3>
              <p className="text-muted-foreground">Balance Sheet as of {dateRange.to}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Assets */}
              <div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-bold text-lg">ASSETS</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Current Assets */}
                    <TableRow>
                      <TableCell className="font-bold">Current Assets</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Cash</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(reportData.assets.current_assets.cash || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Accounts Receivable</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(reportData.assets.current_assets.accounts_receivable)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Raw Materials Inventory</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(reportData.assets.current_assets.inventory_raw)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Work in Progress</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(reportData.assets.current_assets.inventory_wip)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Finished Goods</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(reportData.assets.current_assets.inventory_finished)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Prepaid Expenses</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(reportData.assets.current_assets.prepaid_expenses)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t">
                      <TableCell className="font-medium">Total Current Assets</TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(reportData.assets.current_assets.total_current_assets)}
                      </TableCell>
                    </TableRow>

                    {/* Fixed Assets */}
                    <TableRow>
                      <TableCell className="font-bold pt-4">Fixed Assets</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Equipment</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(reportData.assets.fixed_assets.equipment || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Less: Accumulated Depreciation</TableCell>
                      <TableCell className="text-right text-red-600">
                        ({formatCurrency(Math.abs(reportData.assets.fixed_assets.accumulated_depreciation || 0))})
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Building</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(reportData.assets.fixed_assets.building)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Less: Accumulated Depreciation</TableCell>
                      <TableCell className="text-right text-red-600">
                        ({formatCurrency(Math.abs(reportData.assets.fixed_assets.accumulated_depreciation || 0))})
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t">
                      <TableCell className="font-medium">Total Fixed Assets</TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(reportData.assets.fixed_assets.total_fixed_assets)}
                      </TableCell>
                    </TableRow>

                    {/* Digital Assets */}
                    <TableRow>
                      <TableCell className="font-bold pt-4">Digital Assets</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Software</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(reportData.assets.digital_assets?.software || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Domain Names</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(reportData.assets.digital_assets?.domain_names || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Digital Content</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(reportData.assets.digital_assets?.digital_content || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Digital Assets</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(reportData.assets.digital_assets?.digital_assets || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Cryptocurrency</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(reportData.assets.digital_assets?.cryptocurrency || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">NFT Assets</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(reportData.assets.digital_assets?.nft_assets || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t">
                      <TableCell className="font-medium">Total Digital Assets</TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(reportData.assets.digital_assets?.total_digital_assets || 0)}
                      </TableCell>
                    </TableRow>

                    {/* Other Assets */}
                    <TableRow>
                      <TableCell className="font-bold pt-4">Other Assets</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Prepaid Expenses</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(reportData.assets.other_assets?.prepaid_expenses || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Intangible Assets</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(reportData.assets.other_assets?.intangible_assets || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Other Assets</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(reportData.assets.other_assets?.other_assets || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t">
                      <TableCell className="font-medium">Total Other Assets</TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(reportData.assets.other_assets?.total_other_assets || 0)}
                      </TableCell>
                    </TableRow>

                    {/* Total Assets */}
                    <TableRow className="border-t-2 border-double">
                      <TableCell className="font-bold text-lg">TOTAL ASSETS</TableCell>
                      <TableCell className="text-right font-bold text-lg">
                        {formatCurrency(reportData.assets.total_assets)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Liabilities & Equity */}
              <div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-bold text-lg">LIABILITIES & EQUITY</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Current Liabilities */}
                    <TableRow>
                      <TableCell className="font-bold">Current Liabilities</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Accounts Payable</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(reportData.liabilities.current_liabilities.accounts_payable)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Accrued Expenses</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(reportData.liabilities.current_liabilities.accrued_expenses)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Short-term Debt</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(reportData.liabilities.current_liabilities.short_term_debt)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t">
                      <TableCell className="font-medium">Total Current Liabilities</TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(reportData.liabilities.current_liabilities.total_current_liabilities)}
                      </TableCell>
                    </TableRow>

                    {/* Long-term Liabilities */}
                    <TableRow>
                      <TableCell className="font-bold pt-4">Long-term Liabilities</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Long-term Debt</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(reportData.liabilities.long_term_liabilities.long_term_debt)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t">
                      <TableCell className="font-medium">Total Long-term Liabilities</TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(reportData.liabilities.long_term_liabilities.total_long_term_liabilities)}
                      </TableCell>
                    </TableRow>

                    {/* Total Liabilities */}
                    <TableRow className="border-t-2">
                      <TableCell className="font-bold">TOTAL LIABILITIES</TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(reportData.liabilities.total_liabilities)}
                      </TableCell>
                    </TableRow>

                    {/* Equity */}
                    <TableRow>
                      <TableCell className="font-bold pt-4">Equity</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Retained Earnings</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(reportData.equity.retained_earnings || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Current Year Earnings</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(reportData.equity.current_earnings)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t">
                      <TableCell className="font-medium">Total Equity</TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(reportData.equity.total_equity)}
                      </TableCell>
                    </TableRow>

                    {/* Total Liabilities & Equity */}
                    <TableRow className="border-t-2 border-double">
                      <TableCell className="font-bold text-lg">TOTAL LIABILITIES & EQUITY</TableCell>
                      <TableCell className="text-right font-bold text-lg">
                        {formatCurrency(reportData.liabilities.total_liabilities + reportData.equity.total_equity)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Financial Ratios */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Key Financial Ratios</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{currentRatio.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">Current Ratio</div>
                    <div className="text-xs text-green-600">Healthy &gt;1.0</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{debtToEquity.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">Debt-to-Equity</div>
                    <div className="text-xs text-green-600">Conservative &lt;1.0</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {reportData.assets.total_assets > 0 
                        ? ((reportData.equity.total_equity / reportData.assets.total_assets) * 100).toFixed(1)
                        : 0}%
                    </div>
                    <div className="text-sm text-muted-foreground">Equity Ratio</div>
                    <div className="text-xs text-green-600">Strong &gt;50%</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

import { CSSProperties } from 'react'

export interface ProductLine {
  description: string
  quantity: string
  rate: string
}

export interface Invoice {
  logo: string
  logoWidth: number
  title: string
  companyName: string
  companyName2: string
  name: string
  companyAddress: string
  companyAddress2: string
  companyCountry: string

  billTo: string
  clientName: string
  clientAddress: string
  clientAddress2: string
  clientCountry: string

  invoiceTitleLabel: string
  invoiceTitle: string
  invoiceDateLabel: string
  invoiceDate: string
  invoiceDueDateLabel: string
  invoiceDueDate: string

  productLineDescription: string
  productLineQuantity: string
  productLineQuantityRate: string
  productLineQuantityAmount: string

  productLines: ProductLine[]

  subTotalLabel: string
  taxLabel: string

  totalLabel: string
  currency: string

  notesLabel: string
  notes: string
  termLabel: string
  term: string
  
  umsatzsteuerLabel: string
  umsatzsteuer: string
  ibanLabel: string
  iban: string
  bicLabel: string
  bic: string
}

export interface CSSClasses {
  [key: string]: CSSProperties
}

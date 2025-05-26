import React, { FC, useState, useEffect } from 'react'
import { Invoice, ProductLine } from '../data/types'
import { initialInvoice, initialProductLine } from '../data/initialData'
import EditableInput from './EditableInput'
import EditableTextarea from './EditableTextarea'
import EditableCalendarInput from './EditableCalendarInput'
import EditableFileImage from './EditableFileImage'
import Document from './Document'
import Page from './Page'
import View from './View'
import Text from './Text'
import { Font, Image } from '@react-pdf/renderer'
import Download from './DownloadPDF'
import format from 'date-fns/format'
import { QRCodeCanvas } from 'qrcode.react'
import QRCode from 'qrcode'

Font.register({
  family: 'Nunito',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/nunito/v12/XRXV3I6Li01BKofINeaE.ttf' },
    { src: 'https://fonts.gstatic.com/s/nunito/v12/XRXW3I6Li01BKofA6sKUYevN.ttf', fontWeight: 600 },
  ],
})

interface Props {
  data?: Invoice
  pdfMode?: boolean
  onChange?: (invoice: Invoice) => void
}

const InvoicePage: FC<Props> = ({ data, pdfMode, onChange }) => {
  const [invoice, setInvoice] = useState<Invoice>(data ? { ...data } : { ...initialInvoice })
  const [subTotal, setSubTotal] = useState<number>()
  const [saleTax, setSaleTax] = useState<number>()
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [totalPages, setTotalPages] = useState<number>(1)

  const dateFormat = 'yyyy-MM-dd'
  const ITEMS_PER_PAGE = 15
  
  // Initialize pageProductLines if not present
  useEffect(() => {
    if (!invoice.pageProductLines || invoice.pageProductLines.length === 0) {
      setInvoice({ ...invoice, pageProductLines: [[]] })
    }
  }, [])
  
  // Update totalPages based on pageProductLines length
  useEffect(() => {
    if (invoice.pageProductLines) {
      const pagesWithContent = invoice.pageProductLines.length
      if (pagesWithContent > totalPages) {
        setTotalPages(pagesWithContent)
      }
    }
  }, [invoice.pageProductLines, totalPages])
  
  // Get items for current page
  const getCurrentPageItems = () => {
    if (pdfMode) {
      // For PDF, flatten all pages
      return invoice.pageProductLines?.flat() || []
    }
    // Return items for current page
    return invoice.pageProductLines?.[currentPage - 1] || []
  }
  
  const handleAddPage = () => {
    // Add a new empty page to pageProductLines
    const newPageProductLines = [...(invoice.pageProductLines || [])]
    newPageProductLines.push([])
    setInvoice({ ...invoice, pageProductLines: newPageProductLines })
    setTotalPages(prev => prev + 1)
    setCurrentPage(totalPages + 1)
  }
  
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }
  const invoiceDate = invoice.invoiceDate !== '' ? new Date(invoice.invoiceDate) : new Date()
  const invoiceDueDate =
    invoice.invoiceDueDate !== ''
      ? new Date(invoice.invoiceDueDate)
      : new Date(invoiceDate.valueOf())

  if (invoice.invoiceDueDate === '') {
    invoiceDueDate.setDate(invoiceDueDate.getDate() + 30)
  }

  // Generate SEPA QR Code data
  const generateSepaQRData = () => {
    const subtotal = subTotal || 0
    const tax = subtotal * 0.19 // 19% tax
    const total = subtotal + tax
    const recipient = invoice.name || invoice.companyName || ''
    const iban = invoice.iban || ''
    const bic = invoice.bic || ''
    const reference = invoice.invoiceTitle || 'Rechnung'
    
    // EPC QR Code format for SEPA payments
    return `BCD
002
1
SCT
${bic}
${recipient}
${iban}
EUR${total.toFixed(2)}


${reference}`
  }

  const handleChange = (name: keyof Invoice, value: string | number) => {
    if (name !== 'productLines' && name !== 'pageProductLines') {
      const newInvoice = { ...invoice }

      if (name === 'logoWidth' && typeof value === 'number') {
        newInvoice[name] = value
      } else if (name !== 'logoWidth' && typeof value === 'string') {
        newInvoice[name] = value
      }

      setInvoice(newInvoice)
    }
  }

  const handleProductLineChange = (index: number, name: keyof ProductLine, value: string) => {
    const pageIndex = currentPage - 1
    const newPageProductLines = [...(invoice.pageProductLines || [])]
    
    if (!newPageProductLines[pageIndex]) {
      newPageProductLines[pageIndex] = []
    }
    
    const pageItems = [...newPageProductLines[pageIndex]]
    
    if (pageItems[index]) {
      const newProductLine = { ...pageItems[index] }

      if (name === 'description') {
        newProductLine[name] = value
      } else {
        if (
          value[value.length - 1] === '.' ||
          (value[value.length - 1] === '0' && value.includes('.'))
        ) {
          newProductLine[name] = value
        } else {
          const n = parseFloat(value)
          newProductLine[name] = (n ? n : 0).toString().replace('.',',');
        }
      }

      pageItems[index] = newProductLine
      newPageProductLines[pageIndex] = pageItems
      setInvoice({ ...invoice, pageProductLines: newPageProductLines })
    }
  }

  const handleRemove = (i: number) => {
    const pageIndex = currentPage - 1
    const newPageProductLines = [...(invoice.pageProductLines || [])]
    
    if (newPageProductLines[pageIndex]) {
      const pageItems = newPageProductLines[pageIndex].filter((_, index) => index !== i)
      newPageProductLines[pageIndex] = pageItems
      setInvoice({ ...invoice, pageProductLines: newPageProductLines })
    }
  }

  const handleAdd = () => {
    const pageIndex = currentPage - 1
    const newPageProductLines = [...(invoice.pageProductLines || [])]
    
    if (!newPageProductLines[pageIndex]) {
      newPageProductLines[pageIndex] = []
    }
    
    newPageProductLines[pageIndex] = [...newPageProductLines[pageIndex], { ...initialProductLine }]
    setInvoice({ ...invoice, pageProductLines: newPageProductLines })
  }

  const calculateAmount = (quantity: string, rate: string) => {
    const quantityNumber = parseFloat(quantity)
    const rateNumber = parseFloat(rate)
    const amount = quantityNumber && rateNumber ? quantityNumber * rateNumber : 0

    return amount.toFixed(2)
  }

  useEffect(() => {
    let subTotal = 0

    // Calculate total from all pages
    if (invoice.pageProductLines) {
      invoice.pageProductLines.forEach(pageItems => {
        pageItems.forEach((productLine) => {
          const quantityNumber = parseFloat(productLine.quantity)
          const rateNumber = parseFloat(productLine.rate)
          const amount = quantityNumber && rateNumber ? quantityNumber * rateNumber : 0

          subTotal += amount
        })
      })
    }

    setSubTotal(subTotal)
  }, [invoice.pageProductLines])

  useEffect(() => {
    const match = invoice.taxLabel.match(/(\d+)%/)
    const taxRate = match ? parseFloat(match[1]) : 0
    const saleTax = subTotal ? (subTotal * taxRate) / 100 : 0

    setSaleTax(saleTax)
  }, [subTotal, invoice.taxLabel])

  useEffect(() => {
    if (onChange) {
      onChange(invoice)
    }
  }, [onChange, invoice])

  useEffect(() => {
    // Generate QR code data URL for PDF
    if (invoice.iban && invoice.bic && subTotal) {
      const subtotal = subTotal || 0
      const tax = subtotal * 0.19 // 19% tax
      const total = subtotal + tax
      const recipient = invoice.name || invoice.companyName || ''
      const iban = invoice.iban || ''
      const bic = invoice.bic || ''
      const reference = invoice.invoiceTitle || 'Rechnung'
      
      // EPC QR Code format for SEPA payments
      const qrData = `BCD
002
1
SCT
${bic}
${recipient}
${iban}
EUR${total.toFixed(2)}


${reference}`

      QRCode.toDataURL(qrData, { 
        width: 120,
        margin: 1,
        errorCorrectionLevel: 'M'
      })
        .then(url => setQrCodeDataUrl(url))
        .catch(err => console.error('Error generating QR code:', err))
    }
  }, [invoice.iban, invoice.bic, invoice.name, invoice.companyName, invoice.invoiceTitle, subTotal])

  // Render functions for different sections
  const renderHeader = () => (
    <>
      <View className="flex" pdfMode={pdfMode}>
        <View className="w-50" pdfMode={pdfMode}>
          <EditableFileImage
            className="logo"
            placeholder="Dein Logo"
            value={invoice.logo}
            width={invoice.logoWidth}
            pdfMode={pdfMode}
            onChangeImage={(value) => handleChange('logo', value)}
            onChangeWidth={(value) => handleChange('logoWidth', value)}
          />
          <EditableInput
            className="fs-16 bold"
            placeholder="Firmenname"
            value={invoice.companyName}
            onChange={(value) => handleChange('companyName', value)}
            pdfMode={pdfMode}
          />
          <EditableInput
              className="fs-16 bold"
              placeholder="Firmenname2"
              value={invoice.companyName2}
              onChange={(value) => handleChange('companyName2', value)}
              pdfMode={pdfMode}
          />
          <EditableInput
            placeholder="Dein Vorname"
            value={invoice.name}
            onChange={(value) => handleChange('name', value)}
            pdfMode={pdfMode}
          />
          <EditableInput
            placeholder="Adresse"
            value={invoice.companyAddress}
            onChange={(value) => handleChange('companyAddress', value)}
            pdfMode={pdfMode}
          />
          <EditableInput
            placeholder="Stadt, Postleizahl"
            value={invoice.companyAddress2}
            onChange={(value) => handleChange('companyAddress2', value)}
            pdfMode={pdfMode}
          />
        </View>
        <View className="w-50" pdfMode={pdfMode}>
          <EditableInput
            className="fs-30 right bold"
            placeholder="Rechnung"
            value={invoice.title}
            onChange={(value) => handleChange('title', value)}
            pdfMode={pdfMode}
          />
        </View>
      </View>

      <View className="flex mt-40" pdfMode={pdfMode}>
        <View className="w-55" pdfMode={pdfMode}>
          <EditableInput
            className="bold dark mb-5"
            placeholder="Kunde: "
            value={invoice.billTo}
            onChange={(value) => handleChange('billTo', value)}
            pdfMode={pdfMode}
          />
          <EditableInput
            placeholder="Name:"
            value={invoice.clientName}
            onChange={(value) => handleChange('clientName', value)}
            pdfMode={pdfMode}
          />
          <EditableInput
            placeholder="Adresse"
            value={invoice.clientAddress}
            onChange={(value) => handleChange('clientAddress', value)}
            pdfMode={pdfMode}
          />
          <EditableInput
            placeholder="Stadt, Postleitzahl"
            value={invoice.clientAddress2}
            onChange={(value) => handleChange('clientAddress2', value)}
            pdfMode={pdfMode}
          />
        </View>
        <View className="w-45" pdfMode={pdfMode}>
          <View className="flex mb-5" pdfMode={pdfMode}>
            <View className="w-55" pdfMode={pdfMode}>
              <EditableInput
                className="bold"
                value={invoice.invoiceTitleLabel}
                onChange={(value) => handleChange('invoiceTitleLabel', value)}
                pdfMode={pdfMode}
              />
            </View>
            <View className="w-60" pdfMode={pdfMode}>
              <EditableInput
                placeholder="NUMMER"
                value={invoice.invoiceTitle}
                onChange={(value) => handleChange('invoiceTitle', value)}
                pdfMode={pdfMode}
              />
            </View>
          </View>
          <View className="flex mb-5" pdfMode={pdfMode}>
            <View className="w-55" pdfMode={pdfMode}>
              <EditableInput
                className="bold"
                value={invoice.invoiceDateLabel}
                onChange={(value) => handleChange('invoiceDateLabel', value)}
                pdfMode={pdfMode}
              />
            </View>
            <View className="w-60" pdfMode={pdfMode}>
              <EditableCalendarInput
                value={format(invoiceDate, dateFormat)}
                selected={invoiceDate}
                onChange={(date) =>
                  handleChange(
                    'invoiceDate',
                    date && !Array.isArray(date) ? format(date, dateFormat) : ''
                  )
                }
                pdfMode={pdfMode}
              />
            </View>
          </View>
          <View className="flex mb-5" pdfMode={pdfMode}>
            <View className="w-55" pdfMode={pdfMode}>
              <EditableInput
                className="bold"
                value={invoice.invoiceDueDateLabel}
                onChange={(value) => handleChange('invoiceDueDateLabel', value)}
                pdfMode={pdfMode}
              />
            </View>
            <View className="w-60" pdfMode={pdfMode}>
              <EditableCalendarInput
                value={format(invoiceDueDate, dateFormat)}
                selected={invoiceDueDate}
                onChange={(date) =>
                  handleChange(
                    'invoiceDueDate',
                    date && !Array.isArray(date) ? format(date, dateFormat) : ''
                  )
                }
                pdfMode={pdfMode}
              />
            </View>
          </View>
        </View>
      </View>
    </>
  )

  const renderTable = (items: any[]) => (
    <>
      <View className="mt-30 bg-dark flex" pdfMode={pdfMode}>
        <View className="w-48 p-4-8" pdfMode={pdfMode}>
          <EditableInput
            className="white bold"
            value={invoice.productLineDescription}
            onChange={(value) => handleChange('productLineDescription', value)}
            pdfMode={pdfMode}
          />
        </View>
        <View className="w-17 p-4-8" pdfMode={pdfMode}>
          <EditableInput
            className="white bold right"
            value={invoice.productLineQuantity}
            onChange={(value) => handleChange('productLineQuantity', value)}
            pdfMode={pdfMode}
          />
        </View>
        <View className="w-17 p-4-8" pdfMode={pdfMode}>
          <EditableInput
            className="white bold right"
            value={invoice.productLineQuantityRate}
            onChange={(value) => handleChange('productLineQuantityRate', value)}
            pdfMode={pdfMode}
          />
        </View>
        <View className="w-25 p-4-8" pdfMode={pdfMode}>
          <EditableInput
            className="white bold right"
            value={invoice.productLineQuantityAmount}
            onChange={(value) => handleChange('productLineQuantityAmount', value)}
            pdfMode={pdfMode}
          />
        </View>
      </View>

      {items.map((productLine, i) => {
        return pdfMode && productLine.description === '' ? (
          <Text key={i}></Text>
        ) : (
          <View key={i} className="row flex" pdfMode={pdfMode}>
            <View className="w-48 p-4-8 pb-10" pdfMode={pdfMode}>
              <EditableTextarea
                className="dark"
                rows={1}
                placeholder="Enter item name/description"
                value={productLine.description}
                onChange={(value) => handleProductLineChange(i, 'description', value)}
                pdfMode={pdfMode}
              />
            </View>
            <View className="w-17 p-4-8 pb-10" pdfMode={pdfMode}>
              <EditableInput
                className="dark right"
                value={productLine.quantity}
                onChange={(value) => handleProductLineChange(i, 'quantity', value)}
                pdfMode={pdfMode}
              />
            </View>
            <View className="w-17 p-4-8 pb-10" pdfMode={pdfMode}>
              <EditableInput
                className="dark right"
                value={productLine.rate}
                onChange={(value) => handleProductLineChange(i, 'rate', value)}
                pdfMode={pdfMode}
              />
            </View>
            <View className="w-25 p-4-8 pb-10" pdfMode={pdfMode}>
              <Text className="dark right" pdfMode={pdfMode}>
                {calculateAmount(productLine.quantity, productLine.rate).replace('.',',')}
              </Text>
            </View>
            {!pdfMode && (
              <button
                className="link row__remove"
                aria-label="Remove Row"
                title="Remove Row"
                onClick={() => handleRemove(i)}
              >
                <span className="icon icon-remove bg-red"></span>
              </button>
            )}
          </View>
        )
      })}
    </>
  )

  const renderFooter = () => (
    <>
      <View className="flex" pdfMode={pdfMode}>
        <View className="w-50 mt-10" pdfMode={pdfMode}>
          {!pdfMode && (
            <div>
              <button className="link" onClick={handleAdd}>
                <span className="icon icon-add bg-green mr-10"></span>
                Füge Eintrag hinzu
              </button>
              <div className="mt-10">
                <button className="link" onClick={handleAddPage}>
                  <span className="icon icon-add bg-blue mr-10"></span>
                  Neue Seite erstellen
                </button>
              </div>
              {totalPages > 1 && (
                <div className="mt-10">
                  <span style={{ marginRight: '10px', fontWeight: 'bold' }}>Seite: </span>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      className={`page-nav ${currentPage === page ? 'active' : ''}`}
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </View>
        <View className="w-50 mt-20" pdfMode={pdfMode}>
          <View className="flex" pdfMode={pdfMode}>
            <View className="w-50 p-5" pdfMode={pdfMode}>
              <EditableInput
                value={invoice.subTotalLabel}
                onChange={(value) => handleChange('subTotalLabel', value)}
                pdfMode={pdfMode}
              />
            </View>
            <View className="w-50 p-5" pdfMode={pdfMode}>
              <Text className="right bold dark" pdfMode={pdfMode}>
                {subTotal?.toFixed(2).replace('.',',')}
              </Text>
            </View>
          </View>
          <View className="flex" pdfMode={pdfMode}>
            <View className="w-50 p-5" pdfMode={pdfMode}>
              <EditableInput
                value={invoice.taxLabel}
                onChange={(value) => handleChange('taxLabel', value)}
                pdfMode={pdfMode}
              />
            </View>
            <View className="w-50 p-5" pdfMode={pdfMode}>
              <Text className="right bold dark" pdfMode={pdfMode}>
                {saleTax?.toFixed(2).replace('.',',')}
              </Text>
            </View>
          </View>
          <View className="flex bg-gray p-5" pdfMode={pdfMode}>
            <View className="w-50 p-5" pdfMode={pdfMode}>
              <EditableInput
                className="bold"
                value={invoice.totalLabel}
                onChange={(value) => handleChange('totalLabel', value)}
                pdfMode={pdfMode}
              />
            </View>
            <View className="w-50 p-5 flex" pdfMode={pdfMode}>
              <EditableInput
                className="dark bold right ml-30"
                value={invoice.currency}
                onChange={(value) => handleChange('currency', value)}
                pdfMode={pdfMode}
              />
              <Text className="right bold dark w-auto" pdfMode={pdfMode}>
                {(typeof subTotal !== 'undefined' && typeof saleTax !== 'undefined'
                  ? subTotal + saleTax
                  : 0
                ).toFixed(2).replace('.',',')}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View className="mt-8" pdfMode={pdfMode}>
        <EditableInput
          className="bold w-100"
          value={invoice.notesLabel}
          onChange={(value) => handleChange('notesLabel', value)}
          pdfMode={pdfMode}
        />
        <EditableTextarea
          className="w-100"
          rows={1}
          value={invoice.notes}
          onChange={(value) => handleChange('notes', value)}
          pdfMode={pdfMode}
        />
      </View>
      <View className="mt-8" pdfMode={pdfMode}>
        <View className="flex" pdfMode={pdfMode}>
          <View className="w-33 pr-10" pdfMode={pdfMode}>
            <EditableInput
              className="bold mb-5"
              value={invoice.umsatzsteuerLabel}
              onChange={(value) => handleChange('umsatzsteuerLabel', value)}
              pdfMode={pdfMode}
            />
            <EditableInput
              placeholder="DE123456789"
              value={invoice.umsatzsteuer}
              onChange={(value) => handleChange('umsatzsteuer', value)}
              pdfMode={pdfMode}
            />
          </View>
          <View className="w-33 pr-10" pdfMode={pdfMode}>
            <EditableInput
              className="bold mb-5"
              value={invoice.ibanLabel}
              onChange={(value) => handleChange('ibanLabel', value)}
              pdfMode={pdfMode}
            />
            <EditableInput
              placeholder="DE12 3456 7890 1234 5678 90"
              value={invoice.iban}
              onChange={(value) => handleChange('iban', value)}
              pdfMode={pdfMode}
            />
          </View>
          <View className="w-33 flex" pdfMode={pdfMode}>
            <View className="w-60" pdfMode={pdfMode}>
              <EditableInput
                className="bold mb-5"
                value={invoice.bicLabel}
                onChange={(value) => handleChange('bicLabel', value)}
                pdfMode={pdfMode}
              />
              <EditableInput
                placeholder="ABCDDEFG"
                value={invoice.bic}
                onChange={(value) => handleChange('bic', value)}
                pdfMode={pdfMode}
              />
            </View>
            {invoice.iban && invoice.bic && (
              <View className="w-40 ml-10" pdfMode={pdfMode}>
                {pdfMode && qrCodeDataUrl ? (
                  <View>
                    <Image 
                      src={qrCodeDataUrl} 
                      style={{ width: 60, height: 60, marginLeft: 10 }}
                    />
                    <Text className="fs-10 center mt-5" pdfMode={pdfMode}>SEPA QR</Text>
                  </View>
                ) : !pdfMode ? (
                  <div className="qr-code-wrapper">
                    <QRCodeCanvas
                      value={generateSepaQRData()}
                      size={60}
                      level="M"
                      includeMargin={true}
                    />
                    <Text className="fs-10 center mt-5" pdfMode={pdfMode}>SEPA QR</Text>
                  </div>
                ) : null}
              </View>
            )}
          </View>
        </View>
      </View>
    </>
  )

  // For PDF, create multiple pages if needed
  const renderPDFPages = () => {
    if (!pdfMode) {
      return renderSinglePage()
    }
    
    // Calculate pages for PDF
    const pages = []
    const itemsPerPDFPage = 20 // More items per PDF page
    const totalPDFPages = Math.max(1, Math.ceil(invoice.productLines.length / itemsPerPDFPage))
    
    for (let pageNum = 0; pageNum < totalPDFPages; pageNum++) {
      const startIdx = pageNum * itemsPerPDFPage
      const endIdx = Math.min(startIdx + itemsPerPDFPage, invoice.productLines.length)
      const pageItems = invoice.productLines.slice(startIdx, endIdx)
      const isFirstPage = pageNum === 0
      const isLastPage = pageNum === totalPDFPages - 1
      
      pages.push(
        <Page key={pageNum} className="invoice-wrapper" pdfMode={pdfMode}>
          {isFirstPage && renderHeader()}
          {renderTable(pageItems)}
          {isLastPage && renderFooter()}
        </Page>
      )
    }
    
    return pages
  }
  
  const renderSinglePage = () => {
    return (
      <Page className="invoice-wrapper" pdfMode={pdfMode}>
        {!pdfMode && <Download data={invoice} />}
        {renderHeader()}
        {renderTable(getCurrentPageItems())}
        {renderFooter()}
      </Page>
    )
  }

  return (
    <Document pdfMode={pdfMode}>
      {pdfMode ? renderPDFPages() : renderSinglePage()}
    </Document>
  )
}

export default InvoicePage

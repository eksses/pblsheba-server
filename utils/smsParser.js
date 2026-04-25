/**
 * SMS Parser Utility for Bangladeshi MFS (bKash, Nagad, Rocket)
 */

const parseSms = (body) => {
  const result = {
    trxId: null,
    amount: null,
    provider: 'unknown',
  };

  // 1. Detect Provider & Extract Data
  const lowercaseBody = body.toLowerCase();

  // bKash Detection
  if (lowercaseBody.includes('bkash') || body.includes('TrxID')) {
    result.provider = 'bkash';
    // Match Amount: tk 365 or tk365
    const amountMatch = body.match(/tk\s*([\d,.]+)/i);
    // Match TrxID: TrxID 9K8L7M6N5O
    const trxMatch = body.match(/TrxID\s+([A-Z0-9]+)/);
    
    if (amountMatch) result.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (trxMatch) result.trxId = trxMatch[1];
  } 
  
  // Nagad Detection
  else if (lowercaseBody.includes('nagad') || body.includes('Amount: Tk')) {
    result.provider = 'nagad';
    // Match Amount: Amount: Tk 365
    const amountMatch = body.match(/Amount:\s*Tk\s*([\d,.]+)/i);
    // Match TrxID: TxnID: 8J7K6L5M4N
    const trxMatch = body.match(/TxnID:\s*([A-Z0-9]+)/);

    if (amountMatch) result.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (trxMatch) result.trxId = trxMatch[1];
  }

  // Rocket Detection
  else if (lowercaseBody.includes('rocket') || body.includes('Amt: Tk')) {
    result.provider = 'rocket';
    // Match Amount: Amt: Tk 365
    const amountMatch = body.match(/Amt:\s*Tk\s*([\d,.]+)/i);
    // Match TrxID: TxnID: 7I6J5K4L3M
    const trxMatch = body.match(/TxnID:\s*([A-Z0-9]+)/);

    if (amountMatch) result.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (trxMatch) result.trxId = trxMatch[1];
  }

  return result;
};

module.exports = { parseSms };

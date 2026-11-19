import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import { quotes } from "../lib/mock-data";
import type { Quote } from "../lib/types";
import { CANCELLATION_POLICY_14_DAYS } from "../lib/hotel-policies";
import { requestLanguage, missingEnglishTranslations, translateQuoteText, normalizeTranslations } from "../lib/i18n/quote-language";
import { buildEnglishClientEmail, englishQuoteWhatsapp, assertEnglishReady } from "../lib/i18n/english-client-messages";
import { localizedVoucherData } from "../lib/i18n/english-voucher";
import { toPublicQuoteDTO } from "../lib/public-quote-dto";
import { EnglishQuotePage } from "../components/english/EnglishQuotePage";
import { normalizeQuotePhone } from "../lib/utils";
import { generateVoucherPdf } from "../lib/pdf/generateVoucher";

export function englishTestQuote(): Quote {
  const quote:Quote={...quotes[0],id:"language-test",code:"LAB-LANGUAGE",language:"en",customerFirstName:"Test",customerLastName:"Guest",customerEmail:"english-test@example.com",customerPhone:"+44 7700 900123",arrivalDate:"2027-05-10",departureDate:"2027-05-17",offerExpiresAt:"2027-04-01",servicesIncluded:["Parcheggio incluso"],customerNotes:"Cenone di San Silvestro incluso",paymentPolicy:"Acconto 20% alla conferma. Saldo restante in struttura con carta o contanti.",cancellationPolicy:CANCELLATION_POLICY_14_DAYS,confirmation:undefined,hotelOptions:[]};
  quote.hotelOptions=[{id:"room-option",quoteId:quote.id,hotelGroup:1,position:1,hotelName:"Hotel Test",roomTypeLabel:"Camera matrimoniale standard",hotelReason:"Ottimo rapporto qualità/prezzo",breakfastLabel:"Camera e colazione",halfBoardLabel:"Mezza pensione",fullBoardLabel:"Pensione completa",includedServices:"Parcheggio incluso",depositPercent:20,balanceMethod:"Saldo restante in struttura con carta o contanti.",paymentPolicy:quote.paymentPolicy,cancellationPolicy:quote.cancellationPolicy,isSelected:false,createdAt:"2026-11-19",updatedAt:"2026-11-19",treatments:[{key:"full_board",label:"Pensione completa",price:900}]}];
  return quote;
}
async function main() {
 const quote=englishTestQuote();
 assert.equal(requestLanguage({source_url:"https://ischiastars.it/en/#english-hotel-14"}),"en");
 assert.equal(requestLanguage({source_url:"https://ischiastars.it/hotel/"}),"it");
 assert.equal(requestLanguage({source_url:"https://ischiastars.it/enough/"}),"it");
 assert.equal(requestLanguage({language:"it",source_url:"https://ischiastars.it/en/"}),"it");
 assert.equal(normalizeQuotePhone(quote),"447700900123");
 assert.throws(()=>normalizeQuotePhone({...quote,customerPhone:"07700900123"}));
 assert.equal(normalizeQuotePhone({...quote,language:"it",customerPhone:"3331234567"}),"393331234567");
 assert.equal(translateQuoteText("constructor"),undefined);
 assert.deepEqual(missingEnglishTranslations(quote),[]);
 const incomplete={...quote,customerNotes:"Nota italiana personalizzata"};
 assert.throws(()=>assertEnglishReady(incomplete));
 const prepared={...incomplete,englishTranslations:normalizeTranslations({"Nota italiana personalizzata":"A custom note in English"})};
 assert.doesNotThrow(()=>assertEnglishReady(prepared));
 assert.throws(()=>assertEnglishReady({...prepared,customerNotes:"Nota cambiata dopo la traduzione"}));
 const dto=toPublicQuoteDTO(quote);
 assert.equal(dto.hotelOptions[0].treatments[0].label,"Full board");
 assert.equal(dto.hotelOptions[0].roomTypeLabel,"Standard double room");
 const html=renderToStaticMarkup(createElement(EnglishQuotePage,{quote:dto,trackOpening:false}));
 assert(html.includes("Send booking request"));assert(!html.includes("Pensione completa"));assert(html.includes("Postcode / ZIP code"));
 assert(!html.includes('pattern="[0-9]{5}"'));assert(html.includes("acconsento.click/informative/page/11226/en"));
 const whatsapp=englishQuoteWhatsapp(quote,quote.hotelOptions,"https://example.com/offer");
 assert(whatsapp.includes("Full board"));assert(!whatsapp.includes("Pensione completa"));
 const translated=structuredClone(quote);
 translated.confirmation={confirmedAt:"2026-11-19",fiscalCode:"",address:"Test address",city:"London",zip:"SW1A 1AA",province:"",selectedHotelOptionId:"room-option",selectedTreatmentLabel:"Camera 1: Camera matrimoniale standard, Pensione completa",selectedHotelName:"Hotel Test",selectedPrice:1014,selectedDepositAmount:300,selectedBalanceAmount:714,selectedBalanceMethod:quote.hotelOptions[0].balanceMethod,selectedCancellationPolicy:quote.cancellationPolicy,depositPaidAt:"2026-11-19T10:00:00Z",metadata:{selected_rooms:[{roomTypeLabel:"Camera matrimoniale standard"}],additional_services:[{label:"Aliscafo con transfer",cost:114}]}};
 translated.englishTranslations={"Aliscafo con transfer":"Hydrofoil and transfer"};
 for(const kind of ["quote","confirmation","voucher","balance","follow_up","interested","unavailable"] as const){
  const message=buildEnglishClientEmail(translated,kind,"https://example.com/offer",kind==="unavailable"?{message:"Ultime disponibilità"}:{});
  assert(message.html.includes('lang="en"'));assert(!message.text.includes("Pensione completa"));assert(!message.text.includes("Aliscafo con transfer"));assert(message.subject.includes(quote.code));
 }
 const data=localizedVoucherData(translated,{quoteCode:translated.code,clientFullName:"Test Guest",hotelName:"Hotel Test",roomTypeLabel:"Camera matrimoniale standard",treatmentLabel:"Pensione completa",includedServices:["Parcheggio incluso"],depositAmountLabel:"€300.00",depositPaidAtLabel:"19/11/2026",balanceAmountLabel:"€714.00",cancellationPolicy:translated.cancellationPolicy,whatsappNumber:"393717590017"});
 assert(data.includedServices?.some(line=>line.includes("Hydrofoil and transfer")&&line.includes("114")));
 assert.equal(data.language,"en");assert.equal(data.roomTypeLabel,"Standard double room");
 assert.equal(localizedVoucherData({...translated,language:"it"},data),data);
 fs.mkdirSync("tmp/pdfs",{recursive:true});
 fs.writeFileSync("tmp/pdfs/english-voucher-test.pdf",await generateVoucherPdf(data));
 fs.writeFileSync("tmp/pdfs/english-quote-test.html",html);
 console.log("English flow checks passed: detection, saved translations, stale content, international phone, public form, all customer emails, WhatsApp and voucher PDF.");
}
if(process.argv[1]?.endsWith("english-quotes.test.ts"))void main();

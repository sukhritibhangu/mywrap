import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, Clock, CreditCard, ShieldCheck } from 'lucide-react-native';
import { CartContext } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import Header from '../components/common/Header';
import Button from '../components/common/Button';
import orderService from '../services/orderService';
import { clearCheckoutIntentKey, getCheckoutIntentKey } from '../services/checkoutIntent';
import settingsService from '../services/settingsService';
import tableService from '../services/tableService';
import pickupSlotService from '../services/pickupSlotService';
import couponService from '../services/couponService';
import FulfillmentSelector from '../components/checkout/FulfillmentSelector';
import HostelPicker from '../components/checkout/HostelPicker';
import TableSelector from '../components/checkout/TableSelector';
import COLORS from '../constants/colors';
import ErrorState from '../components/common/ErrorState';



export default function CheckoutScreen() {
  const router = useRouter();
  const { cartItems, subtotal, taxAndFees, grandTotal, clearCart } = useContext(CartContext);
  const { user } = useContext(AuthContext);
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  
  const [settings, setSettings] = useState(null);
  const [settingsError, setSettingsError] = useState(false);
  const [tables, setTables] = useState([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesError, setTablesError] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [submissionError, setSubmissionError] = useState('');
  const [idempotencyReady, setIdempotencyReady] = useState(false);
  
  const [orderType, setOrderType] = useState('TAKEAWAY');
  const [hostel, setHostel] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('COUNTER');
  const [pickupMode, setPickupMode] = useState('IMMEDIATE');
  const [pickupSlots, setPickupSlots] = useState([]);
  const [pickupSlotsLoading, setPickupSlotsLoading] = useState(false);
  const [pickupSlotsError, setPickupSlotsError] = useState('');
  const [scheduledPickupAt, setScheduledPickupAt] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponQuote, setCouponQuote] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [availableOffers, setAvailableOffers] = useState([]);
  const [offersError, setOffersError] = useState('');
  const idempotencyKeyRef = useRef('');
  const preparedFingerprintRef = useRef('');
  const intentFingerprint = useMemo(() => {
    const intent = JSON.stringify({
      userId: user?._id,
      items: cartItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        customizations: (item.customizations || []).map((customization) => customization.name).sort(),
      })),
      orderType,
      paymentMethod,
      scheduledPickupAt: pickupMode === 'SCHEDULED' ? scheduledPickupAt : '',
      couponCode: couponQuote?.code || '',
      hostel: hostel.trim(),
      roomNumber: roomNumber.trim(),
      deliveryInstructions: deliveryInstructions.trim(),
      tableId: selectedTableId,
    });
    let first = 2166136261;
    let second = 2246822519;
    for (let index = 0; index < intent.length; index += 1) {
      const code = intent.charCodeAt(index);
      first = Math.imul(first ^ code, 16777619);
      second = Math.imul(second ^ code, 3266489917);
    }
    return `${first >>> 0}-${second >>> 0}`;
  }, [user?._id, cartItems, orderType, paymentMethod, hostel, roomNumber, deliveryInstructions, selectedTableId, pickupMode, scheduledPickupAt, couponQuote?.code]);

  useEffect(() => {
    let active = true;
    setIdempotencyReady(false);
    preparedFingerprintRef.current = '';
    getCheckoutIntentKey(intentFingerprint)
      .then((key) => {
        if (active) {
          idempotencyKeyRef.current = key;
          preparedFingerprintRef.current = intentFingerprint;
          setIdempotencyReady(true);
        }
      })
      .catch((error) => {
        console.warn('[Checkout Idempotency Error]:', error);
        if (active) {
          // Storage can be unavailable in some web/private-browsing sessions. Keep
          // the server idempotency contract and allow this checkout attempt to proceed.
          idempotencyKeyRef.current = `wrapchik-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
          preparedFingerprintRef.current = intentFingerprint;
          setIdempotencyReady(true);
        }
      });
    return () => { active = false; };
  }, [intentFingerprint]);

  useEffect(() => {
    fetchData();
    couponService.getAvailable().then(res => setAvailableOffers(Array.isArray(res?.coupons) ? res.coupons : [])).catch(error => setOffersError(error.message || 'Offers could not be loaded.'));
  }, []);

  useEffect(() => {
    if (!settings) return;
    if (settings.cashEnabled === false && settings.upiEnabled === true) setPaymentMethod('UPI_QR');
    else if (settings.cashEnabled === false && settings.upiEnabled !== true) setPaymentMethod('');
    else if (!paymentMethod) setPaymentMethod('COUNTER');
  }, [settings?.cashEnabled, settings?.upiEnabled]);

  useEffect(() => {
    if (orderType !== 'TAKEAWAY' || !settings?.scheduledPickupEnabled) { setPickupSlots([]); setScheduledPickupAt(''); setPickupMode('IMMEDIATE'); return; }
    let active = true;
    setPickupSlotsLoading(true); setPickupSlotsError('');
    pickupSlotService.getAvailableSlots().then(res => { if (active) setPickupSlots(Array.isArray(res?.slots) ? res.slots : []); })
      .catch(error => { if (active) setPickupSlotsError(error.message || 'Pickup slots could not be loaded.'); })
      .finally(() => { if (active) setPickupSlotsLoading(false); });
    return () => { active = false; };
  }, [orderType, settings?.scheduledPickupEnabled]);

  useEffect(() => { setCouponQuote(null); setCouponError(''); }, [subtotal, orderType]);

  useEffect(() => {
    if (orderType === 'DINE_IN') {
      fetchTables();
    }
  }, [orderType]);

  const fetchData = async () => {
    try {
      setDataLoading(true);
      const res = await settingsService.getSettings();
      if (!res?.success || !res.settings) throw new Error('Store settings are unavailable.');
      setSettings(res.settings);
      if (!res.settings.takeawayEnabled) {
        if (res.settings.deliveryEnabled) setOrderType('DELIVERY');
        else if (res.settings.dineInEnabled) setOrderType('DINE_IN');
      }
      setSettingsError(false);
    } catch (e) {
      console.warn('[Checkout Settings Error]:', e);
      setSettingsError(true);
    } finally {
      setDataLoading(false);
    }
  };

  const fetchTables = async () => {
    try {
      setTablesLoading(true);
      const res = await tableService.getAvailableTables();
      if (res.success) {
        setTables(res.tables || []);
        setTablesError(false);
      } else throw new Error('Tables could not be loaded.');
    } catch (e) {
      console.warn('[Checkout Tables Error]:', e);
      setTablesError(true);
    } finally {
      setTablesLoading(false);
    }
  };

  const deliveryFee = settings?.deliveryFee ?? 0;
  const couponApplied = Boolean(couponQuote && couponQuote.orderType === orderType);
  const displayTotal = couponApplied ? couponQuote.totalAmount : (orderType === 'DELIVERY' ? grandTotal + deliveryFee : grandTotal);
  const fulfillmentField = orderType === 'TAKEAWAY' ? 'takeawayEnabled' : orderType === 'DELIVERY' ? 'deliveryEnabled' : 'dineInEnabled';
  const fulfillmentEnabled = settings?.[fulfillmentField] === true;

  const handleNext = () => {
    setValidationError('');
    if (step === 1) {
      if (!fulfillmentEnabled) {
        setValidationError('Select a fulfillment option enabled by the outlet.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (orderType === 'TAKEAWAY' && pickupMode === 'SCHEDULED' && (!scheduledPickupAt || pickupSlotsLoading || pickupSlotsError)) {
        setValidationError(pickupSlotsError || 'Choose an available pickup time or select immediate pickup.');
        return;
      }
      if (orderType === 'DELIVERY' && (!hostel || !roomNumber)) {
        setValidationError('Select your hostel and enter your room number to continue.');
        return;
      }
      if (orderType === 'DINE_IN' && !selectedTableId) {
        setValidationError('Select an available table to continue.');
        return;
      }
      if (orderType === 'DINE_IN' && (tablesLoading || tablesError)) {
        setValidationError('Load current table availability before continuing.');
        return;
      }
      setStep(3);
    }
  };

  const handleValidateCoupon = async () => {
    setCouponError(''); setCouponQuote(null);
    if (!user) { setCouponError('Sign in to check whether this coupon is eligible for your account.'); return; }
    if (!couponCode.trim()) { setCouponError('Enter a coupon code.'); return; }
    setCouponLoading(true);
    try {
      const res = await couponService.validate({ code: couponCode.trim(), orderType, items: cartItems.map(item => ({ productId: item.productId, quantity: item.quantity, customizations: item.customizations })) });
      if (!res?.success || !res.quote) throw new Error(res?.message || 'Coupon could not be applied.');
      setCouponQuote(res.quote); setCouponCode(res.quote.code);
    } catch (error) { setCouponError(error.message || 'Coupon could not be applied.'); }
    finally { setCouponLoading(false); }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  const handlePlaceOrder = async () => {
    if (loading || !idempotencyReady || preparedFingerprintRef.current !== intentFingerprint || !cartItems.length || !settings?.acceptingOrders) return;
    if (!user) {
      router.push({ pathname: '/(auth)/login', params: { returnTo: 'checkout' } });
      return;
    }
    try {
      setLoading(true);
      setSubmissionError('');

      const orderPayload = {
        items: cartItems.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          customizations: item.customizations,
        })),
        orderType,
        paymentMethod,
        idempotencyKey: idempotencyKeyRef.current,
        ...(couponQuote?.code ? { couponCode: couponQuote.code } : {}),
        ...(orderType === 'TAKEAWAY' && pickupMode === 'SCHEDULED' ? { scheduledPickupAt } : {}),
      };

      if (orderType === 'DELIVERY') {
        orderPayload.hostel = hostel;
        orderPayload.roomNumber = roomNumber;
        orderPayload.deliveryInstructions = deliveryInstructions;
      } else if (orderType === 'DINE_IN') {
        orderPayload.tableId = selectedTableId;
      } else {
        orderPayload.pickupLocation = settings?.pickupLocation || 'Wrapchik Counter, SAC Ground Floor';
      }

      const res = await orderService.createOrder(orderPayload);

      if (res && res.success && res.order) {
        const orderData = res.order;

        if (['CANCELLED', 'REJECTED'].includes(orderData.orderStatus)) {
          await clearCheckoutIntentKey();
          idempotencyKeyRef.current = await getCheckoutIntentKey(`${intentFingerprint}-new-${Date.now()}`);
          setSubmissionError('A previous attempt for this checkout was cancelled. Review the order and try again.');
          return;
        }
        
        if (paymentMethod === 'COUNTER') {
          await clearCheckoutIntentKey();
          router.replace({
            pathname: '/order-confirmation',
            params: {
              orderId: orderData._id,
              orderNumber: orderData.orderNumber,
              method: 'Pay at Counter (Cash)',
            },
          });
          clearCart();
        } else {
          router.push({
            pathname: '/payment',
            params: {
              orderId: orderData._id,
              amount: orderData.totalAmount,
              orderNumber: orderData.orderNumber,
            },
          });
        }
      } else {
        setSubmissionError(res?.message || 'Unable to place the order. Your cart is unchanged.');
      }
    } catch (error) {
      setSubmissionError(error.message || 'Order creation failed. Your cart is unchanged.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Checkout" showBack={false} showCart={false} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {settings?.acceptingOrders === false ? <View style={styles.closedBanner}><Text style={styles.closedTitle}>The outlet is not accepting orders right now.</Text><Text style={styles.closedText}>You can review checkout details, but placing an order is disabled.</Text></View> : null}
        {/* Step Indicator Header */}
        <View style={styles.stepHeader}>
          <View style={step >= 1 ? styles.stepActive : styles.stepInactive}>
            <Text style={step >= 1 ? styles.stepNum : styles.stepNumInactive}>1</Text>
            <Text style={step >= 1 ? styles.stepText : styles.stepTextInactive}>Mode</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={step >= 2 ? styles.stepActive : styles.stepInactive}>
            <Text style={step >= 2 ? styles.stepNum : styles.stepNumInactive}>2</Text>
            <Text style={step >= 2 ? styles.stepText : styles.stepTextInactive}>Details</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={step >= 3 ? styles.stepActive : styles.stepInactive}>
            <Text style={step >= 3 ? styles.stepNum : styles.stepNumInactive}>3</Text>
            <Text style={step >= 3 ? styles.stepText : styles.stepTextInactive}>Payment</Text>
          </View>
        </View>

        {dataLoading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
        ) : settingsError || !settings ? (
          <ErrorState title="Checkout can’t load store settings" message="We need the outlet’s current pickup and fulfillment settings before placing your order." onRetry={fetchData} />
        ) : (
          <>
            {step === 1 && (
              <View>
                <Text style={styles.sectionTitle}>Select Fulfillment Mode</Text>
                <FulfillmentSelector 
                  selectedMode={orderType} 
                  onSelectMode={(mode) => { setOrderType(mode); setValidationError(''); }}
                  settings={settings} 
                />
              </View>
            )}

            {step === 2 && (
              <View>
                <Text style={styles.sectionTitle}>Fulfillment Details</Text>
                {validationError ? <View style={styles.validationBanner} accessibilityRole="alert"><Text style={styles.validationText}>{validationError}</Text></View> : null}
                
                {orderType === 'DELIVERY' && (
                  <View>
                    <HostelPicker selectedHostel={hostel} onSelectHostel={(value) => { setHostel(value); setValidationError(''); }} />
                    
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Room Number</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. 204"
                        value={roomNumber}
                        onChangeText={(value) => { setRoomNumber(value); setValidationError(''); }}
                      />
                    </View>
                    
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Delivery Instructions (Optional)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Call upon reaching"
                        value={deliveryInstructions}
                        onChangeText={setDeliveryInstructions}
                      />
                    </View>
                  </View>
                )}

                {orderType === 'TAKEAWAY' && (
                  <View style={styles.fulfillmentCard}>
                    <View style={styles.fulfillmentHeader}>
                      <MapPin size={20} color={COLORS.primary} />
                      <Text style={styles.fulfillmentTitle}>Pickup Location</Text>
                    </View>
                    <Text style={styles.fulfillmentAddress}>
                      {settings?.pickupLocation || 'Wrapchik Counter, SAC Ground Floor'}
                    </Text>

                    <View style={styles.timeBadge}>
                      <Clock size={16} color={COLORS.warning} />
                      <Text style={styles.timeText}>{settings?.estimatedPrepMinutes ? `About ${settings.estimatedPrepMinutes} minutes` : 'Prep time will be confirmed by the kitchen'}</Text>
                    </View>
                    {settings?.scheduledPickupEnabled ? <View style={styles.scheduleBlock}>
                      <Text style={styles.label}>Pickup timing</Text>
                      <View style={styles.pickupModeRow}>
                        {['IMMEDIATE', 'SCHEDULED'].map(mode => <TouchableOpacity key={mode} onPress={() => { setPickupMode(mode); setValidationError(''); if (mode === 'IMMEDIATE') setScheduledPickupAt(''); }} style={[styles.pickupModeChip, pickupMode === mode && styles.pickupModeChipActive]}><Text style={[styles.pickupModeText, pickupMode === mode && styles.pickupModeTextActive]}>{mode === 'IMMEDIATE' ? 'As soon as ready' : 'Schedule a time'}</Text></TouchableOpacity>)}
                      </View>
                      {pickupMode === 'SCHEDULED' ? pickupSlotsLoading ? <Text style={styles.slotHint}>Loading live pickup slots…</Text> : pickupSlotsError ? <ErrorState title="Pickup times unavailable" message={pickupSlotsError} onRetry={() => { setPickupSlotsError(''); pickupSlotService.getAvailableSlots().then(res => setPickupSlots(res?.slots || [])).catch(error => setPickupSlotsError(error.message || 'Retry failed.')); }} /> : pickupSlots.length ? <View style={styles.slotGrid}>{pickupSlots.map(slot => { const selected = scheduledPickupAt === slot.startsAt; return <TouchableOpacity key={slot.startsAt} onPress={() => { setScheduledPickupAt(slot.startsAt); setValidationError(''); }} style={[styles.slotChip, selected && styles.slotChipSelected]}><Text style={[styles.slotText, selected && styles.slotTextSelected]}>{new Date(slot.startsAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</Text><Text style={[styles.slotCapacity, selected && styles.slotTextSelected]}>{slot.availableCount} available</Text></TouchableOpacity>; })}</View> : <Text style={styles.slotHint}>No scheduled pickup times are available. Choose immediate pickup.</Text> : null}
                    </View> : null}
                  </View>
                )}

                {orderType === 'DINE_IN' && (
                  <View>
                    <TableSelector 
                      tables={tables} 
                      selectedTableId={selectedTableId} 
                      onSelectTable={(tableId) => { setSelectedTableId(tableId); setValidationError(''); }}
                      loading={tablesLoading}
                    />
                    {tablesError ? <ErrorState title="Tables could not be loaded" message="Retry to see current table availability." onRetry={fetchTables} retrying={tablesLoading} /> : null}
                  </View>
                )}
              </View>
            )}

            {step === 3 && (
              <View>
                <Text style={styles.sectionTitle}>Order for</Text>
                <View style={styles.customerCard}>
                  <Text style={styles.customerName}>{user?.name || 'Sign in required'}</Text>
                  {user?.email ? <Text style={styles.customerDetail}>{user.email}</Text> : null}
                  {user?.phone ? <Text style={styles.customerDetail}>{user.phone}</Text> : null}
                  <Text style={styles.customerNote}>{user ? 'The order will be linked to your signed-in Wrapchik account.' : 'Sign in to place this order. Your cart will be kept while you sign in.'}</Text>
                </View>
                <Text style={styles.sectionTitle}>Order Summary</Text>
                <View style={styles.couponCard}>
                  <Text style={styles.couponTitle}>Have a coupon?</Text>
                  <View style={styles.couponEntry}><TextInput value={couponCode} onChangeText={value => { setCouponCode(value.toUpperCase()); setCouponQuote(null); setCouponError(''); }} placeholder="Enter code" autoCapitalize="characters" style={styles.couponInput} /><TouchableOpacity disabled={couponLoading} onPress={handleValidateCoupon} style={[styles.couponButton, couponLoading && { opacity: .6 }]}><Text style={styles.couponButtonText}>{couponLoading ? 'Checking…' : 'Apply'}</Text></TouchableOpacity></View>
                  {couponApplied ? <View style={styles.couponAppliedRow}><Text style={styles.couponAppliedText}>{couponQuote.code} applied · save ₹{couponQuote.discountAmount}</Text><TouchableOpacity onPress={() => { setCouponQuote(null); setCouponCode(''); setCouponError(''); }}><Text style={styles.removeCoupon}>Remove</Text></TouchableOpacity></View> : null}
                  {!!couponError && <Text style={styles.couponError}>{couponError}</Text>}
                  {availableOffers.length ? <View style={styles.offerList}><Text style={styles.offerHeading}>Available offers</Text>{availableOffers.map(offer => <TouchableOpacity key={offer.code} onPress={() => { setCouponCode(offer.code); setCouponQuote(null); setCouponError(''); }} style={styles.offerRow}><View style={{ flex: 1 }}><Text style={styles.offerCode}>{offer.code} · {offer.discountType === 'PERCENT' ? `${offer.discountValue}% off` : `₹${offer.discountValue} off`}</Text><Text style={styles.offerTerms}>{offer.minOrderValue > 0 ? `Minimum order ₹${offer.minOrderValue}` : 'No minimum'}{offer.maxDiscountAmount ? ` · Up to ₹${offer.maxDiscountAmount}` : ''}</Text></View><Text style={styles.offerSelect}>Use</Text></TouchableOpacity>)}</View> : offersError ? <Text style={styles.offerTerms}>{offersError}</Text> : null}
                </View>
                <View style={styles.summaryCard}>
                  {cartItems.map((item, idx) => (
                    <View key={idx} style={styles.itemRow}>
                      <Text style={styles.itemQty}>{item.quantity}×</Text>
                      <View style={styles.itemNameBox}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        {item.customizations?.length > 0 && (
                          <Text style={styles.itemCust}>
                            {item.customizations.map((c) => c.name).join(', ')}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.itemPrice}>₹{item.unitPrice * item.quantity}</Text>
                    </View>
                  ))}

                  <View style={styles.divider} />

                  <View style={styles.costRow}>
                    <Text style={styles.costLabel}>Subtotal</Text>
                    <Text style={styles.costVal}>₹{couponApplied ? couponQuote.subtotal : subtotal}</Text>
                  </View>
                  {couponApplied ? <View style={styles.costRow}><Text style={styles.costLabel}>Coupon discount</Text><Text style={styles.discountVal}>−₹{couponQuote.discountAmount}</Text></View> : null}
                  <View style={styles.costRow}>
                    <Text style={styles.costLabel}>Taxes & Fees</Text>
                    <Text style={styles.costVal}>₹{couponApplied ? couponQuote.taxAndFees : taxAndFees}</Text>
                  </View>
                  
                  {orderType === 'DELIVERY' && (
                    <View style={styles.costRow}>
                      <Text style={styles.costLabel}>Delivery Fee</Text>
                      <Text style={styles.costVal}>₹{couponApplied ? couponQuote.deliveryFee : deliveryFee}</Text>
                    </View>
                  )}

                  <View style={styles.costRowTotal}>
                    <Text style={styles.totalLabel}>Estimated total</Text>
                    <Text style={styles.totalVal}>₹{displayTotal}</Text>
                  </View>
                  <Text style={styles.pricingNote}>Product availability and the final amount are checked by Wrapchik when you place the order.</Text>
                </View>

                <Text style={styles.sectionTitle}>Payment Method</Text>
                <View style={styles.paymentMethods}>
                  {settings?.cashEnabled !== false ? <TouchableOpacity 
                    style={[styles.paymentCard, paymentMethod === 'COUNTER' && styles.paymentCardSelected]}
                    onPress={() => setPaymentMethod('COUNTER')}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: paymentMethod === 'COUNTER' }}
                  >
                    <ShieldCheck size={24} color={paymentMethod === 'COUNTER' ? COLORS.primary : COLORS.textSecondary} />
                    <Text style={[styles.paymentText, paymentMethod === 'COUNTER' && styles.paymentTextSelected]}>Cash at Counter</Text>
                  </TouchableOpacity> : null}
                  
                  {settings?.upiEnabled === true && !!settings?.upiId && !!settings?.upiPayeeName ? <TouchableOpacity
                    style={[styles.paymentCard, paymentMethod === 'UPI_QR' && styles.paymentCardSelected]}
                    onPress={() => setPaymentMethod('UPI_QR')}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: paymentMethod === 'UPI_QR' }}
                  >
                    <CreditCard size={24} color={paymentMethod === 'UPI_QR' ? COLORS.primary : COLORS.textSecondary} />
                    <Text style={[styles.paymentText, paymentMethod === 'UPI_QR' && styles.paymentTextSelected]}>Pay via UPI</Text>
                  </TouchableOpacity> : null}
                </View>
                {settings?.cashEnabled === false && settings?.upiEnabled !== true ? <Text style={styles.pricingNote}>The outlet has not enabled a payment method yet. Please try again later.</Text> : null}
                {paymentMethod === 'COUNTER' && settings?.cashEnabled !== false ? <Text style={styles.pricingNote}>Pay cash at the Wrapchik counter when you collect your order.</Text> : null}
                {paymentMethod === 'UPI_QR' ? <Text style={styles.pricingNote}>After placing your order, scan the outlet QR and pay the exact total shown. Payment stays pending until the admin verifies receipt.</Text> : null}
                {submissionError ? <View style={styles.validationBanner} accessibilityRole="alert"><Text style={styles.validationText}>{submissionError}</Text></View> : null}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Footer Nav */}
      <View style={styles.footer}>
        <View style={styles.footerActions}>
          <Button
            title="Back"
            variant="outline"
            onPress={handleBack}
            style={styles.actionBtn}
          />
          {step < 3 ? (
            <Button
              title="Next"
              onPress={handleNext}
              disabled={dataLoading || settingsError || !settings || (step === 1 && !fulfillmentEnabled)}
              style={styles.actionBtn}
            />
          ) : (
            <Button
            title={user ? paymentMethod === 'COUNTER' ? `Place Order (₹${displayTotal})` : `Continue to UPI (₹${displayTotal})` : 'Sign in to place order'}
              onPress={handlePlaceOrder}
              disabled={!cartItems.length || !settings?.acceptingOrders || !idempotencyReady || (step === 3 && !paymentMethod) || preparedFingerprintRef.current !== intentFingerprint}
              loading={loading}
              style={styles.actionBtn}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  stepActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    opacity: 0.5,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 22,
  },
  stepNumInactive: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.border,
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 22,
  },
  stepText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  stepTextInactive: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  stepLine: {
    width: 30,
    height: 2,
    backgroundColor: COLORS.border,
    marginHorizontal: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  validationBanner: { marginBottom: 14, padding: 12, borderRadius: 12, backgroundColor: COLORS.dangerLight, borderWidth: 1, borderColor: '#F2C8C8' },
  validationText: { color: COLORS.danger, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  fulfillmentCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  fulfillmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  fulfillmentTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  fulfillmentAddress: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warningLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    alignSelf: 'flex-start',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.warning,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  customerCard: { backgroundColor: '#FFFFFF', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 18 },
  customerName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '800' },
  customerDetail: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  customerNote: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 8 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemQty: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
    marginRight: 8,
  },
  itemNameBox: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  itemCust: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  costLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  costVal: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  costRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  totalVal: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primary,
  },
  pricingNote: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 6 },
  closedBanner: { padding: 14, borderRadius: 15, backgroundColor: COLORS.warningLight, marginBottom: 16 },
  closedTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800' },
  closedText: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 4 },
  paymentMethods: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  paymentCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  paymentText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  paymentTextSelected: {
    color: COLORS.primary,
  },
  onlinePaymentPanel: {
    marginTop: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  onlinePaymentTitle: {
    marginBottom: 10,
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  onlinePaymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  onlineMethodCard: {
    width: '48%',
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 9,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  onlineMethodCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  onlineMethodCopy: {
    flex: 1,
  },
  onlineMethodLabel: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  onlineMethodLabelSelected: {
    color: COLORS.primary,
  },
  onlineMethodDescription: {
    marginTop: 2,
    color: COLORS.textSecondary,
    fontSize: 10,
  },
  onlinePaymentNote: {
    marginTop: 10,
    color: COLORS.textSecondary,
    fontSize: 10,
    lineHeight: 15,
  },
  scheduleBlock: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 14, paddingTop: 12 },
  pickupModeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  pickupModeChip: { paddingVertical: 9, paddingHorizontal: 11, borderWidth: 1, borderColor: COLORS.border, borderRadius: 9, backgroundColor: '#fff' },
  pickupModeChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  pickupModeText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },
  pickupModeTextActive: { color: COLORS.primary },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: { minWidth: 135, padding: 9, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, backgroundColor: '#fff' },
  slotChipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  slotText: { color: COLORS.textPrimary, fontSize: 11, fontWeight: '800' },
  slotTextSelected: { color: '#fff' },
  slotCapacity: { color: COLORS.textSecondary, fontSize: 10, marginTop: 4 },
  slotHint: { color: COLORS.textSecondary, fontSize: 12, marginTop: 6 },
  couponCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 13, marginBottom: 12 },
  couponTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '800', marginBottom: 8 },
  couponEntry: { flexDirection: 'row', gap: 8 }, couponInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 9, color: COLORS.textPrimary, fontSize: 13 },
  couponButton: { backgroundColor: COLORS.primary, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 8 }, couponButtonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  couponAppliedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }, couponAppliedText: { color: '#2E7C44', fontSize: 11, fontWeight: '700' }, removeCoupon: { color: COLORS.danger, fontSize: 11, fontWeight: '800' }, couponError: { color: COLORS.danger, fontSize: 11, marginTop: 7 }, discountVal: { fontSize: 13, fontWeight: '700', color: '#2E7C44' },
  offerList: { marginTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8 }, offerHeading: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '800', marginBottom: 4 }, offerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#F3F1EE' }, offerCode: { color: COLORS.textPrimary, fontSize: 11, fontWeight: '800' }, offerTerms: { color: COLORS.textSecondary, fontSize: 10, marginTop: 3 }, offerSelect: { color: COLORS.primary, fontSize: 11, fontWeight: '900' },
  footer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
  },
});

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { reunionPaymentsService, ReunionPaymentRecord } from '../api/firebase/reunionPayments/service';

const debounce = (fn: (...args: any[]) => void, delay = 250) => {
  let t: any;
  return (...args: any[]) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
};

const HaveYouPaidPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ReunionPaymentRecord[]>([]);
  const [selected, setSelected] = useState<ReunionPaymentRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [apr1Amount, setApr1Amount] = useState<number | undefined>();
  const [aug1Amount, setAug1Amount] = useState<number | undefined>();
  const [dec1Amount, setDec1Amount] = useState<number | undefined>();
  const [newPaymentAmount, setNewPaymentAmount] = useState<number | undefined>();

  const [rows, setRows] = useState<ReunionPaymentRecord[]>([]);
  const [loadingRows, setLoadingRows] = useState<boolean>(true);
  const [isAdminView, setIsAdminView] = useState<boolean>(false);
  const [passcode, setPasscode] = useState<string>('');
  const [paymentModal, setPaymentModal] = useState<{open: boolean; row: ReunionPaymentRecord | null}>({ open: false, row: null });
  const [modalAmount, setModalAmount] = useState<string>('');
  const [editNameModal, setEditNameModal] = useState<{open: boolean; row: ReunionPaymentRecord | null}>({ open: false, row: null });
  const [editedName, setEditedName] = useState<string>('');
  const [depositCount, setDepositCount] = useState<number>(0);

  const runSearch = useMemo(
    () => debounce(async (text: string) => {
      if (!text.trim()) { setSuggestions([]); return; }
      setIsLoading(true);
      try {
        const results = await reunionPaymentsService.searchByNamePrefix(text, 8);
        setSuggestions(results);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }, 200),
    []
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setQuery(text);
    setSelected(null);
    setMessage(null);
    runSearch(text);
  };

  const handlePick = (rec: ReunionPaymentRecord) => {
    setSelected(rec);
    setQuery(rec.name);
    setSuggestions([]);
    setApr1Amount(rec.apr1Amount);
    setAug1Amount(rec.aug1Amount);
    setDec1Amount(rec.dec1Amount);
    setNewPaymentAmount(undefined);
  };

  const refreshTableAndCount = async () => {
    const all = await reunionPaymentsService.listAll();
    setRows(all.sort((a,b)=> (a.name||'').localeCompare(b.name||'')));
    
    // Update deposit count
    const peopleWithDeposits = all.filter(r => 
      (r.apr1Amount && r.apr1Amount > 0) || 
      (r.aug1Amount && r.aug1Amount > 0) || 
      (r.dec1Amount && r.dec1Amount > 0)
    ).length;
    setDepositCount(peopleWithDeposits);
  };

  const handleSave = async () => {
    const name = (selected?.name || query).trim();
    if (!name) { setMessage('Please enter a name.'); return; }
    try {
      setIsLoading(true);
      // Determine where to place the new payment amount (first empty slot; else accumulate in Dec 1st)
      let a1 = apr1Amount ?? 0;
      let a2 = aug1Amount ?? 0;
      let a3 = dec1Amount ?? 0;
      if (newPaymentAmount && newPaymentAmount > 0) {
        if (!a1) a1 = newPaymentAmount;
        else if (!a2) a2 = newPaymentAmount;
        else a3 = a3 + newPaymentAmount;
      }

      const id = await reunionPaymentsService.upsert({
        id: selected?.id,
        name,
        apr1Amount: a1 || undefined,
        aug1Amount: a2 || undefined,
        dec1Amount: a3 || undefined,
      });
      setMessage('Saved!');
      setSelected({ id, name, apr1Amount: a1 || undefined, aug1Amount: a2 || undefined, dec1Amount: a3 || undefined });
      // Refresh table
      setLoadingRows(true);
      await refreshTableAndCount();
      setLoadingRows(false);
    } catch (e) {
      console.error(e);
      setMessage('There was an error saving.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNewPerson = async () => {
    const name = query.trim();
    if (!name) { setMessage('Please enter a name.'); return; }
    try {
      setIsLoading(true);
      const id = await reunionPaymentsService.upsert({ name });
      setMessage('Person added!');
      setSelected({ id, name });
      await refreshTableAndCount();
    } catch (e) {
      console.error(e);
      setMessage('There was an error adding the person.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPersonFromTable = async () => {
    const name = (typeof window !== 'undefined') ? window.prompt('Enter full name to add:') : '';
    if (!name) return;
    try {
      setIsLoading(true);
      const id = await reunionPaymentsService.upsert({ name: name.trim() });
      setMessage('Person added!');
      await refreshTableAndCount();
    } catch (e) {
      console.error(e);
      setMessage('There was an error adding the person.');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-seed on first load if collection empty (localhost only to avoid prod pollution)
  useEffect(() => {
    const autoSeed = async () => {
      try {
        const hasData = await reunionPaymentsService.hasAny();
        const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
        if (!hasData && isLocalhost) {
          await fetch('/api/seed-reunion-payments', { method: 'POST' });
        }
        const all = await reunionPaymentsService.listAll();
        setRows(all.sort((a,b)=> (a.name||'').localeCompare(b.name||'')));
        
        // Count people who have made at least one deposit
        const peopleWithDeposits = all.filter(r => 
          (r.apr1Amount && r.apr1Amount > 0) || 
          (r.aug1Amount && r.aug1Amount > 0) || 
          (r.dec1Amount && r.dec1Amount > 0)
        ).length;
        setDepositCount(peopleWithDeposits);
        
        setLoadingRows(false);
      } catch (e) {
        // silent
      }
    };
    autoSeed();
  }, []);

  return (
    <>
      <Head>
        <title>Have You Paid - Anderson Family Reunion</title>
      </Head>
      <div className="min-h-screen bg-[#0f1115] text-white">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <h1 className="text-2xl md:text-3xl font-semibold mb-4">Have you paid up your balance for the Anderson Family Reunion?</h1>
          
          {/* Exciting Deposit Counter */}
          {depositCount > 0 && (
            <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-700/50">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-green-400 mb-1">
                  {depositCount} {depositCount === 1 ? 'person has' : 'people have'}
                </div>
                <div className="text-lg md:text-xl text-green-300">
                  put down deposits! 🎉
                </div>
              </div>
            </div>
          )}
          
          <p className="text-gray-300 mb-6">Enter your name below to check.</p>

          <div className="relative mb-6">
            <input
              type="text"
              value={query}
              onChange={handleChange}
              placeholder="Type your name..."
              className="w-full bg-[#1a1f28] border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {isLoading && (
              <div className="absolute right-3 top-3 text-gray-400 text-sm">Loading...</div>
            )}
            {suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-[#1a1f28] border border-gray-700 rounded-lg shadow-lg max-h-64 overflow-auto">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handlePick(s)}
                    className="w-full text-left px-4 py-2 hover:bg-[#242b36]"
                  >{s.name}</button>
                ))}
              </div>
            )}
          </div>

          {selected && (
            <div className="mb-6 p-4 rounded-lg border border-gray-700 bg-[#12161d]">
              <div className="font-medium mb-2">Current record</div>
              <div className="text-sm text-gray-300">
                {(() => {
                  const total = (selected.apr1Amount ?? 0) + (selected.aug1Amount ?? 0) + (selected.dec1Amount ?? 0);
                  const owed = Math.max(200 - total, 0);
                  return (
                    <>
                      <div>Total Paid: ${total}</div>
                      <div>Amount Owed: ${owed}</div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {message && <div className="text-sm text-gray-300 mb-6">{message}</div>}

          <div className="text-xs text-gray-500">Note: This is a simple family tool. No personal payment info is stored here—just names and amounts.</div>

          {/* Admin Passcode */}
          <div className="mt-8 p-4 rounded-lg border border-gray-700 bg-[#12161d]">
            <div className="flex items-center gap-3">
              <input
                type="password"
                value={passcode}
                onChange={(e)=>setPasscode(e.target.value)}
                placeholder="Admin passcode"
                className="flex-1 bg-[#1a1f28] border border-gray-700 rounded-lg px-3 py-2 focus:outline-none"
              />
              <button
                onClick={() => setIsAdminView(passcode.trim() === (process.env.NEXT_PUBLIC_HAVEYOUPAID_PASSCODE || 'anderson2025'))}
                className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 hover:bg-zinc-700"
              >{isAdminView ? 'Passcode Verified' : 'Unlock Admin'}</button>
            </div>
            {!isAdminView && <div className="text-xs text-gray-400 mt-2">Admin features (table, edit/remove) are hidden until unlocked.</div>}
          </div>

          {/* Table (Admin Only) */}
          {isAdminView && (
          <div className="mt-10 bg-[#11151b] border border-gray-800 rounded-xl overflow-x-auto">
            <div className="flex items-center justify-between p-3 border-b border-gray-800 text-gray-300">
              <div className="font-medium">Admin Table</div>
              <button onClick={handleAddPersonFromTable} className="px-3 py-1 rounded-md bg-zinc-800 border border-zinc-700 hover:bg-zinc-700">Add Person</button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Total Paid</th>
                  <th className="text-left p-3">Total Owed</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingRows && (
                  <tr><td className="p-4 text-gray-400" colSpan={3}>Loading…</td></tr>
                )}
                {!loadingRows && rows.length === 0 && (
                  <tr><td className="p-4 text-gray-400" colSpan={3}>No records found.</td></tr>
                )}
                 {!loadingRows && rows.map(r => (
                  <tr key={r.id} className="border-b border-gray-900 hover:bg-[#151a21]">
                    <td className="p-3 text-white">
                      <button
                        className="underline underline-offset-2 hover:text-blue-300"
                        onClick={() => {
                          setPaymentModal({ open: true, row: r });
                          setModalAmount('');
                        }}
                      >{r.name}</button>
                    </td>
                    <td className="p-3 text-gray-300">${(r.apr1Amount ?? 0) + (r.aug1Amount ?? 0) + (r.dec1Amount ?? 0)}</td>
                    <td className="p-3 text-gray-300">${Math.max(200 - ((r.apr1Amount ?? 0) + (r.aug1Amount ?? 0) + (r.dec1Amount ?? 0)), 0)}</td>
                     <td className="p-3 text-gray-300">
                       <div className="flex gap-2">
                         <button
                           className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500"
                           onClick={() => {
                             setEditNameModal({ open: true, row: r });
                             setEditedName(r.name);
                           }}
                         >Edit</button>
                         <button
                           className="px-3 py-1 rounded-md bg-red-600 hover:bg-red-500"
                           onClick={async () => {
                             if (!r.id) return;
                             if (!confirm(`Remove ${r.name}?`)) return;
                             await reunionPaymentsService.deleteById(r.id);
                             setRows(prev => prev.filter(x => x.id !== r.id));
                           }}
                         >Remove</button>
                       </div>
                     </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}

          {/* Add Payment Modal */}
          {paymentModal.open && paymentModal.row && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPaymentModal({ open: false, row: null })}>
              <div className="bg-[#11151b] border border-gray-800 rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                  <div className="font-semibold">Add Payment</div>
                  <button className="text-gray-400 hover:text-white" onClick={() => setPaymentModal({ open: false, row: null })}>✕</button>
                </div>
                <div className="p-4 text-gray-300 space-y-3">
                  <p>You are adding an amount to <span className="text-white font-medium">{paymentModal.row.name}</span>.</p>
                  <p>This will be added to their total paid. We track up to three entries under the hood and then keep a running sum for any extra contributions.</p>
                  <input
                    type="number"
                    value={modalAmount}
                    onChange={(e)=>setModalAmount(e.target.value)}
                    placeholder="Enter amount (e.g., 50)"
                    className="w-full bg-[#1a1f28] border border-gray-700 rounded-lg px-3 py-2 focus:outline-none"
                  />
                </div>
                <div className="p-4 border-t border-gray-800 flex justify-end gap-2">
                  <button className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 hover:bg-zinc-700" onClick={()=>setPaymentModal({ open: false, row: null })}>Cancel</button>
                  <button
                    className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500"
                    onClick={async ()=>{
                      const amt = Number(modalAmount);
                      if (!paymentModal.row?.id || !amt || amt <= 0) return;
                      await reunionPaymentsService.addPaymentById(paymentModal.row.id, amt);
                      await refreshTableAndCount();
                      setPaymentModal({ open: false, row: null });
                    }}
                  >Add Amount</button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Name Modal */}
          {editNameModal.open && editNameModal.row && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setEditNameModal({ open: false, row: null })}>
              <div className="bg-[#11151b] border border-gray-800 rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                  <div className="font-semibold">Edit Name</div>
                  <button className="text-gray-400 hover:text-white" onClick={() => setEditNameModal({ open: false, row: null })}>✕</button>
                </div>
                <div className="p-4 text-gray-300 space-y-3">
                  <p>Edit the name for <span className="text-white font-medium">{editNameModal.row.name}</span>.</p>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e)=>setEditedName(e.target.value)}
                    placeholder="Enter new name"
                    className="w-full bg-[#1a1f28] border border-gray-700 rounded-lg px-3 py-2 focus:outline-none"
                  />
                </div>
                <div className="p-4 border-t border-gray-800 flex justify-end gap-2">
                  <button className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 hover:bg-zinc-700" onClick={()=>setEditNameModal({ open: false, row: null })}>Cancel</button>
                  <button
                    className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500"
                    onClick={async ()=>{
                      const newName = editedName.trim();
                      if (!editNameModal.row?.id || !newName) return;
                      
                      // Use upsert to update the name while keeping payment data
                      await reunionPaymentsService.upsert({
                        id: editNameModal.row.id,
                        name: newName,
                        apr1Amount: editNameModal.row.apr1Amount,
                        aug1Amount: editNameModal.row.aug1Amount,
                        dec1Amount: editNameModal.row.dec1Amount,
                      });
                      
                      await refreshTableAndCount();
                      setEditNameModal({ open: false, row: null });
                      setMessage('Name updated successfully!');
                    }}
                  >Save Name</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default HaveYouPaidPage;



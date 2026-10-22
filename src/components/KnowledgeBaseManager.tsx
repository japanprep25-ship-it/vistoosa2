import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

export const KnowledgeBaseManager = () => {
  const [product, setProduct] = useState({ name: '', sku: '', price: '', stock: 'In Stock', fabric: '' });

  const handleAdd = async () => {
    await addDoc(collection(db, 'products'), product);
    alert('Product added!');
  };

  return (
    <div className="p-6 bg-zinc-900 rounded-xl text-white">
      <h2 className="text-xl font-bold mb-4">AI Knowledge Base Manager</h2>
      <div className="grid gap-4">
        <input placeholder="Name" className="p-2 bg-zinc-800 rounded" onChange={e => setProduct({...product, name: e.target.value})} />
        <input placeholder="SKU" className="p-2 bg-zinc-800 rounded" onChange={e => setProduct({...product, sku: e.target.value})} />
        <input placeholder="Price" className="p-2 bg-zinc-800 rounded" onChange={e => setProduct({...product, price: e.target.value})} />
        <button onClick={handleAdd} className="bg-emerald-500 p-2 rounded">Submit</button>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { partnersAPI, investmentsAPI, settingsAPI } from '../services/api';
import { getCurrencySymbol, formatCurrency } from '../utils/currency';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  UserIcon,
  PhoneIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function Partners() {
  const [partners, setPartners] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'investor',
    phone_no: '',
  });

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    try {
      setLoading(true);
      const [partnersRes, investmentsRes, settingsRes] = await Promise.all([
        partnersAPI.getAll(),
        investmentsAPI.getAll(),
        settingsAPI.getSettings(),
      ]);
      setPartners(partnersRes.data.partners);
      setInvestments(investmentsRes.data.investments);
      setSettings(settingsRes.data.settings);
    } catch (error) {
      toast.error('Failed to load partners');
      console.error('Partners error:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePartnerTotalInvestment = (partnerId) => {
    const partnerInvestments = investments.filter(inv => inv.partner_id === partnerId);
    const totalInvestments = partnerInvestments
      .filter(inv => inv.type === 'invest')
      .reduce((sum, inv) => sum + parseFloat(inv.amount), 0);
    const totalWithdrawals = partnerInvestments
      .filter(inv => inv.type === 'withdraw')
      .reduce((sum, inv) => sum + parseFloat(inv.amount), 0);
    return totalInvestments - totalWithdrawals;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPartner) {
        await partnersAPI.update(editingPartner.id, formData);
        toast.success('Partner updated successfully');
      } else {
        await partnersAPI.create(formData);
        toast.success('Partner created successfully');
      }
      setShowModal(false);
      setEditingPartner(null);
      setFormData({ name: '', type: 'investor', phone_no: '' });
      fetchPartners();
    } catch (error) {
      toast.error(editingPartner ? 'Failed to update partner' : 'Failed to create partner');
      console.error('Partner save error:', error);
    }
  };

  const handleEdit = (partner) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      type: partner.type,
      phone_no: partner.phone_no || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this partner?')) {
      try {
        await partnersAPI.delete(id);
        toast.success('Partner deleted successfully');
        fetchPartners();
      } catch (error) {
        toast.error('Failed to delete partner');
        console.error('Partner delete error:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({ name: '', type: 'investor', phone_no: '' });
    setEditingPartner(null);
    setShowModal(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 dark:text-white sm:text-3xl sm:truncate">
            Partners
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your investors and suppliers
          </p>
        </div>
        <div className="mt-4 flex md:mt-0 md:ml-4">
          <button
            onClick={() => setShowModal(true)}
            className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            Add Partner
          </button>
        </div>
      </div>

      {/* Partners List */}
      <div className="bg-white dark:bg-gray-800 shadow dark:shadow-gray-700 overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {partners.length === 0 ? (
            <li className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
              No partners found. Add your first partner to get started.
            </li>
          ) : (
            partners.map((partner) => (
              <li key={partner.id}>
                <div className="px-4 py-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        partner.type === 'investor' ? 'bg-green-100 dark:bg-green-900' : 'bg-blue-100 dark:bg-blue-900'
                      }`}>
                        <UserIcon className={`h-6 w-6 ${
                          partner.type === 'investor' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'
                        }`} />
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {partner.name}
                            </p>
                            <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              partner.type === 'investor' 
                                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-400' 
                                : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-400'
                            }`}>
                              {partner.type}
                            </span>
                          </div>
                          {partner.phone_no && (
                            <div className="flex items-center mt-1">
                              <PhoneIcon className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-1" />
                              <p className="text-sm text-gray-500 dark:text-gray-400">{partner.phone_no}</p>
                            </div>
                          )}
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            Created: {new Date(partner.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        {partner.type === 'investor' && (
                          <div className="text-right">
                            <div className="flex items-center">
                              <CurrencyDollarIcon className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-1" />
                              <p className={`text-sm font-medium ${
                                calculatePartnerTotalInvestment(partner.id) >= 0 
                                  ? 'text-green-600 dark:text-green-400' 
                                  : 'text-red-600 dark:text-red-400'
                              }`}>
                                {formatCurrency(calculatePartnerTotalInvestment(partner.id), settings?.currency || 'LKR', 0)}
                              </p>
                            </div>
                            <p className="text-xs text-gray-400 dark:text-gray-500">Total Investment</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEdit(partner)}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 p-1"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(partner.id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-1"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-gray-900 dark:bg-opacity-75 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                {editingPartner ? 'Edit Partner' : 'Add New Partner'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Enter partner name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Type *
                  </label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="investor">Investor</option>
                    <option value="supplier">Supplier</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone_no}
                    onChange={(e) => setFormData({ ...formData, phone_no: e.target.value })}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Enter phone number"
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
                  >
                    {editingPartner ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
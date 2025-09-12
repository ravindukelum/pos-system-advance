import React, { useState, useEffect, useCallback } from 'react';
import {
  PaperAirplaneIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  DocumentTextIcon,
  UsersIcon,
  PhoneIcon,
  CalendarIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { whatsappAPI, customersAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const Messages = () => {
  // const { } = useAuth(); // Not currently using auth context
  const [activeTab, setActiveTab] = useState('send');
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [messageHistory, setMessageHistory] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Send message form state
  const [sendForm, setSendForm] = useState({
    recipient: '',
    message: '',
    type: 'text'
  });
  
  // Template form state
  const [templateForm, setTemplateForm] = useState({
    name: '',
    content: '',
    variables: []
  });
  
  // Bulk message state
  const [bulkForm, setBulkForm] = useState({
    recipients: [],
    message: '',
    template_id: ''
  });
  
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState([]);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadCustomers(),
        loadMessageHistory(),
        loadTemplates(),
        checkWhatsAppStatus()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const loadCustomers = async () => {
    try {
      const response = await customersAPI.getAll();
      setCustomers(response.data.customers || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const loadMessageHistory = async () => {
    try {
      const response = await whatsappAPI.getMessageHistory({ limit: 50 });
      setMessageHistory(response.data.messages || []);
    } catch (error) {
      console.error('Error loading message history:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await whatsappAPI.getTemplates();
      setTemplates(response.data.templates || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const checkWhatsAppStatus = async () => {
    try {
      const response = await whatsappAPI.getStatus();
      setWhatsappStatus(response.data);
    } catch (error) {
      console.error('Error checking WhatsApp status:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!sendForm.recipient || !sendForm.message) return;

    setLoading(true);
    try {
      await whatsappAPI.sendMessage({
        to: sendForm.recipient,
        message: sendForm.message,
        type: sendForm.type
      });
      
      setSendForm({ recipient: '', message: '', type: 'text' });
      await loadMessageHistory();
      alert('Message sent successfully!');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSendBulkMessages = async () => {
    if (selectedCustomers.length === 0 || !bulkForm.message) return;

    setLoading(true);
    try {
      const recipients = selectedCustomers.map(customer => customer.phone);
      await whatsappAPI.sendBulkMessages({
        recipients,
        message: bulkForm.message,
        template_id: bulkForm.template_id || null
      });
      
      setBulkForm({ recipients: [], message: '', template_id: '' });
      setSelectedCustomers([]);
      setShowBulkModal(false);
      await loadMessageHistory();
      alert(`Bulk messages sent to ${recipients.length} recipients!`);
    } catch (error) {
      console.error('Error sending bulk messages:', error);
      alert('Failed to send bulk messages: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!templateForm.name || !templateForm.content) return;

    setLoading(true);
    try {
      await whatsappAPI.createTemplate(templateForm);
      setTemplateForm({ name: '', content: '', variables: [] });
      setShowTemplateModal(false);
      await loadTemplates();
      alert('Template created successfully!');
    } catch (error) {
      console.error('Error creating template:', error);
      alert('Failed to create template: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'delivered':
        return <CheckCircleIcon className="h-5 w-5 text-blue-500" />;
      case 'read':
        return <CheckCircleIcon className="h-5 w-5 text-blue-600" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.includes(searchTerm)
  );

  const filteredMessages = messageHistory.filter(message =>
    message.recipient?.includes(searchTerm) ||
    message.message?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && messageHistory.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            WhatsApp Messages
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Send and manage WhatsApp messages to your customers
          </p>
        </div>
        
        {/* WhatsApp Status */}
        <div className="flex items-center space-x-4">
          {whatsappStatus && (
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
              whatsappStatus.status === 'Connected' 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                whatsappStatus.status === 'Connected' ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span className="text-sm font-medium">
                {whatsappStatus.status === 'Connected' ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          )}
          
          <button
            onClick={checkWhatsAppStatus}
            className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            title="Refresh Status"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'send', name: 'Send Message', icon: PaperAirplaneIcon },
            { id: 'history', name: 'Message History', icon: ClockIcon },
            { id: 'templates', name: 'Templates', icon: DocumentTextIcon },
            { id: 'bulk', name: 'Bulk Messages', icon: UsersIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Send Message Tab */}
      {activeTab === 'send' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Send WhatsApp Message
          </h3>
          
          <form onSubmit={handleSendMessage} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Recipient Phone Number
              </label>
              <div className="flex space-x-2">
                <input
                  type="tel"
                  value={sendForm.recipient}
                  onChange={(e) => setSendForm({ ...sendForm, recipient: e.target.value })}
                  placeholder="+1234567890"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
                <select
                  value={sendForm.recipient}
                  onChange={(e) => setSendForm({ ...sendForm, recipient: e.target.value })}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select Customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.phone}>
                      {customer.name} - {customer.phone}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Message
              </label>
              <textarea
                value={sendForm.message}
                onChange={(e) => {
                  console.log('Textarea onChange:', e.target.value);
                  setSendForm({ ...sendForm, message: e.target.value });
                }}
                placeholder="Type your message here..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
              {/* Debug info */}
              <div className="text-xs text-gray-500 mt-1">
                Message value: "{sendForm.message}" (length: {sendForm.message?.length || 0})
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading || !sendForm.recipient || !sendForm.message}
                className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
                <span>{loading ? 'Sending...' : 'Send Message'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Message History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Message History
              </h3>
              <button
                onClick={loadMessageHistory}
                className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              >
                <ArrowPathIcon className="h-5 w-5" />
              </button>
            </div>
            
            {/* Search */}
            <div className="mt-4 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search messages..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredMessages.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                No messages found
              </div>
            ) : (
              filteredMessages.map((message, index) => (
                <div key={message.id || `message-${message.phone}-${message.timestamp}-${index}`} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <PhoneIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {message.recipient}
                        </span>
                        {getStatusIcon(message.status)}
                      </div>
                      <p className="mt-2 text-gray-600 dark:text-gray-300">
                        {message.message}
                      </p>
                      <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center space-x-1">
                          <CalendarIcon className="h-4 w-4" />
                          <span>{new Date(message.created_at).toLocaleString()}</span>
                        </span>
                        <span className="capitalize">{message.status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Message Templates
            </h3>
            <button
              onClick={() => setShowTemplateModal(true)}
              className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              <span>New Template</span>
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.length === 0 ? (
              <div className="col-span-full text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">
                  {loading ? 'Loading templates...' : 'No templates available'}
                </p>
              </div>
            ) : (
              templates.map((template) => (
                <div key={template.id} className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {template.name}
                  </h4>
                  <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                    {template.content}
                  </p>
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => {
                        const templateContent = template.content || template.description || '';
                        setSendForm(prev => ({ ...prev, message: templateContent }));
                        setActiveTab('send');
                      }}
                      className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 text-sm"
                    >
                      Use Template
                    </button>
                  </div>
                 </div>
               ))
            )}
          </div>
        </div>
      )}

      {/* Bulk Messages Tab */}
      {activeTab === 'bulk' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Send Bulk Messages
            </h3>
            <button
              onClick={() => setShowBulkModal(true)}
              className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <UsersIcon className="h-5 w-5" />
              <span>Select Recipients</span>
            </button>
          </div>
          
          {selectedCustomers.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Selected Recipients ({selectedCustomers.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {selectedCustomers.map((customer) => (
                  <span
                    key={customer.id}
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-300"
                  >
                    {customer.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Message
              </label>
              <textarea
                value={bulkForm.message}
                onChange={(e) => setBulkForm({ ...bulkForm, message: e.target.value })}
                placeholder="Type your bulk message here..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={handleSendBulkMessages}
                disabled={loading || selectedCustomers.length === 0 || !bulkForm.message}
                className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
                <span>{loading ? 'Sending...' : `Send to ${selectedCustomers.length} Recipients`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Create New Template
              </h3>
              <form onSubmit={handleCreateTemplate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Template Content
                  </label>
                  <textarea
                    value={templateForm.content}
                    onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowTemplateModal(false)}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
                  >
                    Create Template
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Recipients Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-96 overflow-y-auto">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Select Recipients
              </h3>
              
              {/* Search */}
              <div className="mb-4 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {filteredCustomers.map((customer) => (
                  <label key={customer.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                    <input
                      type="checkbox"
                      checked={selectedCustomers.some(c => c.id === customer.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCustomers([...selectedCustomers, customer]);
                        } else {
                          setSelectedCustomers(selectedCustomers.filter(c => c.id !== customer.id));
                        }
                      }}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {customer.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {customer.phone}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              
              <div className="flex justify-end space-x-3 mt-4">
                <button
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowBulkModal(false)}
                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
                >
                  Select ({selectedCustomers.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;
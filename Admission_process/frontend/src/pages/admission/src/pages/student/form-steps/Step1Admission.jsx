import React, { useState, useEffect } from 'react';
import api from '../../../../../../services/api';
import { Loader2, ChevronRight, CheckCircle2, XCircle, Fingerprint, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import SelectDropdown from '../../../components/SelectDropdown';

const Step1Admission = ({ onNext, data, updateData, applicationStatus, adminRemarks, readOnly = false }) => {
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(false);
    const [originalValues, setOriginalValues] = useState(null);

    useEffect(() => {
        if (data && !originalValues) {
            setOriginalValues({ ...data });
        }
    }, [data, originalValues]);

    const isFieldFlagged = (fieldName) => {
        if (applicationStatus !== 'CORRECTION_REQUIRED' && applicationStatus !== 'REJECTED') return false;
        if (!adminRemarks) return false;
        const remarksLower = adminRemarks.toLowerCase();
        const matches = {
            admissionType: ['admission type'],
            branchId: ['preferred branch', 'branch'],
            aadhaar: ['aadhaar'],
            cetNumber: ['cet number', 'comedk application number', 'kcet number', 'entrance score card'],
            dcetNumber: ['dcet number', 'entrance score card'],
            qualification: ['qualification']
        };
        const keywords = matches[fieldName] || [];
        return keywords.some(kw => remarksLower.includes(kw));
    };

    const ALL_STEP1_FIELDS = ['admissionType', 'branchId', 'aadhaar', 'cetNumber', 'dcetNumber', 'qualification'];
    const hasFlaggedFieldsInStep1 = ALL_STEP1_FIELDS.some(f => isFieldFlagged(f));

    const isFieldDisabled = (fieldName) => {
        if (readOnly) return true;
        if (applicationStatus !== 'CORRECTION_REQUIRED') return false;
        if (hasFlaggedFieldsInStep1) {
            return !isFieldFlagged(fieldName);
        }
        return false;
    };

    const isFieldCorrected = (fieldName) => {
        if (!originalValues) return false;
        if (!isFieldFlagged(fieldName)) return false;
        
        const currentValue = data[fieldName] || '';
        const originalValue = originalValues[fieldName] || '';
        
        return currentValue !== originalValue;
    };

    const getFieldContainerClass = (fieldName, extra = "") => {
        const base = `space-y-1.5 p-3 rounded-xl transition-all duration-300 ${extra}`;
        if (!isFieldFlagged(fieldName)) return base;
        if (isFieldCorrected(fieldName)) {
            return `${base} border-2 border-emerald-500 bg-emerald-50/10`;
        }
        return `${base} border-2 border-red-500 bg-red-50/10`;
    };

    const getFieldInputClass = (fieldName, extra = "") => {
        const baseClass = `input-premium h-11 uppercase ${extra}`;
        if (!isFieldFlagged(fieldName)) return baseClass;
        if (isFieldCorrected(fieldName)) {
            return `${baseClass} border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/20`;
        }
        return `${baseClass} border-red-500 focus:border-red-500 focus:ring-red-500/20`;
    };

    const renderFeedback = (fieldName) => {
        if (!isFieldFlagged(fieldName)) return null;
        if (isFieldCorrected(fieldName)) {
            return (
                <p className="text-emerald-600 text-[11px] font-bold mt-1 flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-emerald-500" /> Corrected
                </p>
            );
        }
        return (
            <p className="text-red-500 text-[11px] font-bold mt-1">
                🔴 Requires correction / verification
            </p>
        );
    };

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const res = await api.get('/branches');
                if (res.data.success) {
                    const filtered = (res.data.data || []).filter(b => 
                        b.code !== 'AS' && 
                        b.type !== 'SEMESTER_HANDLING' && 
                        !b.name?.toLowerCase().includes('applied science')
                    );
                    setBranches(filtered);
                }
            } catch (err) {
                toast.error('Failed to load branches', { id: 'fetch-branches-error' });
            }
        };
        fetchBranches();
    }, []);

    // ── Aadhaar Debounced Check ────────────────────────────
    useEffect(() => {
        const checkAadhaarUniqueness = async () => {
            const val = data.aadhaar;
            if (!val || val.length !== 12 || isNaN(val)) {
                if (val && val.length > 0 && (val.length !== 12 || isNaN(val))) {
                    setAadhaarError('Aadhaar must be a 12-digit number');
                } else {
                    setAadhaarError('');
                }
                return;
            }

            setIsCheckingAadhaar(true);
            setAadhaarError('');

            try {
                const res = await api.post('/student/check-aadhaar', { aadhaar: val });
                if (res.data.exists) {
                    setAadhaarError('This Aadhaar is already registered with another application.');
                } else {
                    setAadhaarError('');
                }
            } catch (err) {
                console.error('Aadhaar check failed', err);
            } finally {
                setIsCheckingAadhaar(false);
            }
        };

        const timer = setTimeout(checkAadhaarUniqueness, 600);
        return () => clearTimeout(timer);
    }, [data.aadhaar]);

    // ── CET Number Debounced Check ─────────────────────────
    useEffect(() => {
        const checkCetUniqueness = async () => {
            const val = data.cetNumber || data.dcetNumber;
            const type = data.admissionType;

            if (!val || val.length < 3 || type === 'MANAGEMENT') {
                setCetError('');
                return;
            }

            setIsCheckingCet(true);
            setCetError('');

            try {
                const res = await api.post('/student/check-cet', { 
                    cetNumber: val,
                    type: type
                });
                if (res.data.exists) {
                    setCetError(`This ${type} registration number is already in use.`);
                } else {
                    setCetError('');
                }
            } catch (err) {
                console.error('CET check failed', err);
            } finally {
                setIsCheckingCet(false);
            }
        };

        const timer = setTimeout(checkCetUniqueness, 600);
        return () => clearTimeout(timer);
    }, [data.cetNumber, data.dcetNumber, data.admissionType]);

    // Auto-synchronize qualification based on admissionType
    useEffect(() => {
        if ((data.admissionType === 'KCET' || data.admissionType === 'COMEDK') && data.qualification !== 'PUC') {
            updateData({ qualification: 'PUC' });
        } else if (data.admissionType === 'DCET' && data.qualification !== 'DIPLOMA') {
            updateData({ qualification: 'DIPLOMA' });
        }
    }, [data.admissionType, data.qualification, updateData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (readOnly) {
            onNext();
            return;
        }
        
        if (aadhaarError || cetError) {
            toast.error('Please resolve the errors before proceeding.');
            return;
        }

        if (!data.admissionType) {
            toast.error('Please select Admission Type.');
            return;
        }

        if (!data.branchId) {
            toast.error('Please select your Preferred Branch.');
            return;
        }

        if (!data.qualification) {
            toast.error('Please select your Qualification.');
            return;
        }

        if (!data.aadhaar || data.aadhaar.length !== 12) {
            toast.error('Please enter a valid 12-digit Aadhaar number.');
            return;
        }

        if ((data.admissionType === 'KCET' || data.admissionType === 'COMEDK') && !data.cetNumber?.trim()) {
            toast.error(`Please enter your ${data.admissionType} Number.`);
            return;
        }

        if (data.admissionType === 'DCET' && !data.dcetNumber?.trim()) {
            toast.error('Please enter your DCET Number.');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                admissionType: data.admissionType,
                branchId: data.branchId || null,
                aadhaar: data.aadhaar,
                cetNumber: data.cetNumber,
                dcetNumber: data.dcetNumber,
                qualification: data.qualification
            };

            const res = await api.post('/student/create', payload);
            if (res.data.success) {
                toast.success('Admission info saved!');
                onNext();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save admission info');
        } finally {
            setLoading(false);
        }
    };

    // Validation states
    const [isCheckingAadhaar, setIsCheckingAadhaar] = useState(false);
    const [aadhaarError, setAadhaarError] = useState('');
    const [isCheckingCet, setIsCheckingCet] = useState(false);
    const [cetError, setCetError] = useState('');
    const isFormDisabled = !readOnly && (loading || isCheckingAadhaar || isCheckingCet || !!aadhaarError || !!cetError);

    return (
        <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
            <div className="space-y-6 flex flex-col p-0 m-0 border-0 w-full">
            <div className="flex items-center gap-3 mb-1">
                <div className="w-1 h-6 bg-primary-600 rounded-full"></div>
                <h2 className="text-lg font-semibold text-slate-900">Step 1: Admission Details</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                {/* Admission Type */}
                <div className={getFieldContainerClass('admissionType')}>
                    <label className="block text-sm font-medium text-slate-700">Admission Type <span className="text-red-500">*</span></label>
                    <SelectDropdown
                        id="admissionType"
                        required
                        disabled={isFieldDisabled('admissionType')}
                        value={data.admissionType || ''}
                        onChange={(val) => {
                            const updates = { admissionType: val, cetNumber: '', dcetNumber: '' };
                            if (val === 'DCET') {
                                updates.qualification = 'DIPLOMA';
                            } else if (val === 'KCET' || val === 'COMEDK') {
                                updates.qualification = 'PUC';
                            }
                            updateData(updates);
                        }}
                        placeholder="Select admission type..."
                        options={[
                            { value: 'KCET', label: 'KCET (Karnataka Common Entrance Test)' },
                            { value: 'COMEDK', label: 'COMEDK (Consortium of Medical Engineering and Dental Colleges)' },
                            { value: 'DCET', label: 'DCET (Diploma Common Entrance Test)' },
                            { value: 'MANAGEMENT', label: 'Management Quota' },
                        ]}
                    />
                    {renderFeedback('admissionType')}
                    {!data.admissionType && applicationStatus === 'REJECTED' && (
                        <p className="text-red-500 text-[11px] font-bold mt-1">Please fill this field mandatorily</p>
                    )}
                </div>

                {/* Preferred Branch */}
                <div className={getFieldContainerClass('branchId')}>
                    <label className="block text-sm font-medium text-slate-700">Preferred Branch <span className="text-red-500">*</span></label>
                    <SelectDropdown
                        id="branchId"
                        required
                        disabled={isFieldDisabled('branchId')}
                        value={data.branchId || ''}
                        onChange={(val) => updateData({ branchId: val })}
                        placeholder="Select preferred engineering branch..."
                        options={branches
                            .filter(b => b.code !== 'AS' && b.type !== 'SEMESTER_HANDLING' && !b.name?.toLowerCase().includes('applied science'))
                            .map(b => ({ value: b.id, label: `${b.name} (${b.code})` }))
                        }
                    />
                    {renderFeedback('branchId')}
                    {!data.branchId && applicationStatus === 'REJECTED' && (
                        <p className="text-red-500 text-[11px] font-bold mt-1">Please fill this field mandatorily</p>
                    )}
                </div>

                {/* Qualification (displayed only for MANAGEMENT) */}
                {data.admissionType === 'MANAGEMENT' && (
                    <div className={getFieldContainerClass('qualification', 'md:col-span-2')}>
                        <label className="block text-sm font-medium text-slate-700">Qualification <span className="text-red-500">*</span></label>
                        <SelectDropdown
                            id="qualification"
                            required
                            disabled={isFieldDisabled('qualification')}
                            value={data.qualification || ''}
                            onChange={(val) => updateData({ qualification: val })}
                            placeholder="Select qualification..."
                            options={[
                                { value: 'PUC', label: 'PUC / 12th Standard' },
                                { value: 'DIPLOMA', label: 'Diploma' },
                            ]}
                        />
                        {renderFeedback('qualification')}
                        {!data.qualification && applicationStatus === 'REJECTED' && (
                            <p className="text-red-500 text-[11px] font-bold mt-1">Please fill this field mandatorily</p>
                        )}
                    </div>
                )}

                {/* COMEDK Number */}
                {data.admissionType === 'COMEDK' && (
                    <div className={getFieldContainerClass('cetNumber')}>
                        <label className="block text-sm font-medium text-slate-700">COMEDK Application Number <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <input
                                required
                                disabled={isFieldDisabled('cetNumber')}
                                type="text"
                                className={getFieldInputClass('cetNumber', 'pr-10')}
                                value={data.cetNumber || ''}
                                onChange={(e) => updateData({ cetNumber: e.target.value.toUpperCase() })}
                                placeholder="Enter COMEDK application number"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                                {isCheckingCet && <Loader2 size={18} className="animate-spin text-slate-400" />}
                                {!isCheckingCet && data.cetNumber?.length > 3 && !cetError && <CheckCircle2 size={18} className="text-emerald-500" />}
                                {!isCheckingCet && cetError && <XCircle size={18} className="text-red-500" />}
                            </div>
                        </div>
                        {renderFeedback('cetNumber')}
                        {!data.cetNumber && applicationStatus === 'REJECTED' && (
                            <p className="text-red-500 text-[11px] font-bold mt-1">Please fill this field mandatorily</p>
                        )}
                        {cetError && <p className="text-[11px] font-medium text-red-500">{cetError}</p>}
                    </div>
                )}

                {/* Aadhaar Number */}
                <div className={getFieldContainerClass('aadhaar', 'md:col-span-2')}>
                    <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
                        <Fingerprint size={16} className="text-slate-400" />
                        Aadhaar Number (UIDAI) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <input
                            required
                            disabled={isFieldDisabled('aadhaar')}
                            type="text"
                            maxLength={12}
                            placeholder="Enter 12-digit aadhaar number"
                            className={getFieldInputClass('aadhaar', `pr-10 ${
                                (aadhaarError) ? 'border-red-500 ring-red-50' : 
                                (data.aadhaar?.length === 12 && !isCheckingAadhaar) ? 'border-emerald-500 ring-emerald-50' : ''
                            }`)}
                            value={data.aadhaar || ''}
                            onChange={(e) => updateData({ aadhaar: e.target.value.replace(/\D/g, '') })}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                            {isCheckingAadhaar && <Loader2 size={18} className="animate-spin text-slate-400" />}
                            {!isCheckingAadhaar && data.aadhaar?.length === 12 && !aadhaarError && <CheckCircle2 size={18} className="text-emerald-500" />}
                            {!isCheckingAadhaar && (aadhaarError || isFieldFlagged('aadhaar')) && <XCircle size={18} className="text-red-500" />}
                        </div>
                    </div>
                    {renderFeedback('aadhaar')}
                    {!data.aadhaar && applicationStatus === 'REJECTED' && (
                        <p className="text-red-500 text-[11px] font-bold mt-1">Please fill this field mandatorily</p>
                    )}
                    {aadhaarError ? (
                        <p className="text-[11px] font-medium text-red-500 flex items-center gap-1 mt-1">
                            <XCircle size={12} /> {aadhaarError}
                        </p>
                    ) : (
                        <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mt-1">
                            <Info size={12} /> Aadhaar is required to prevent duplicate application profiles.
                        </p>
                    )}
                </div>

                {/* KCET Number */}
                {data.admissionType === 'KCET' && (
                    <div className={getFieldContainerClass('cetNumber')}>
                        <label className="block text-sm font-medium text-slate-700">KCET Number <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <input
                                required
                                disabled={isFieldDisabled('cetNumber')}
                                type="text"
                                className={getFieldInputClass('cetNumber', 'pr-10')}
                                value={data.cetNumber || ''}
                                onChange={(e) => updateData({ cetNumber: e.target.value.toUpperCase() })}
                                placeholder="Enter kcet number"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                                {isCheckingCet && <Loader2 size={18} className="animate-spin text-slate-400" />}
                                {!isCheckingCet && data.cetNumber?.length > 3 && !cetError && <CheckCircle2 size={18} className="text-emerald-500" />}
                                {!isCheckingCet && cetError && <XCircle size={18} className="text-red-500" />}
                            </div>
                        </div>
                        {renderFeedback('cetNumber')}
                        {!data.cetNumber && applicationStatus === 'REJECTED' && (
                            <p className="text-red-500 text-[11px] font-bold mt-1">Please fill this field mandatorily</p>
                        )}
                        {cetError && <p className="text-[11px] font-medium text-red-500">{cetError}</p>}
                    </div>
                )}

                {/* DCET Number */}
                {data.admissionType === 'DCET' && (
                    <div className={getFieldContainerClass('dcetNumber')}>
                        <label className="block text-sm font-medium text-slate-700">DCET Number <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <input
                                required
                                disabled={isFieldDisabled('dcetNumber')}
                                type="text"
                                className={getFieldInputClass('dcetNumber', 'pr-10')}
                                value={data.dcetNumber || ''}
                                onChange={(e) => updateData({ dcetNumber: e.target.value.toUpperCase() })}
                                placeholder="Enter dcet number"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                                {isCheckingCet && <Loader2 size={18} className="animate-spin text-slate-400" />}
                                {!isCheckingCet && data.dcetNumber?.length > 3 && !cetError && <CheckCircle2 size={18} className="text-emerald-500" />}
                                {!isCheckingCet && cetError && <XCircle size={18} className="text-red-500" />}
                            </div>
                        </div>
                        {renderFeedback('dcetNumber')}
                        {!data.dcetNumber && applicationStatus === 'REJECTED' && (
                            <p className="text-red-500 text-[11px] font-bold mt-1">Please fill this field mandatorily</p>
                        )}
                        {cetError && <p className="text-[11px] font-medium text-red-500">{cetError}</p>}
                    </div>
                )}
            </div>
            </div>

            <div className="flex justify-end items-center pt-4 sm:pt-6 border-t border-slate-100 mt-6 sm:mt-8 sticky bottom-0 bg-white/95 backdrop-blur-md p-3 sm:p-0 -mx-4 -mb-4 sm:mx-0 sm:mb-0 sm:static sm:bg-transparent z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] sm:shadow-none">
                <button 
                    type="submit" 
                    id="bottom-submit-btn"
                    disabled={isFormDisabled} 
                    className={`btn-primary min-h-[48px] sm:min-h-[44px] h-11 px-8 w-full sm:w-auto flex items-center justify-center ${isFormDisabled ? 'opacity-50 cursor-not-allowed shadow-none' : ''}`}
                >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : (
                        <span className="flex items-center gap-2">
                            {readOnly ? 'Continue' : 'Save & Continue'}
                            <ChevronRight size={16} />
                        </span>
                    )}
                </button>
            </div>
        </form>
    );
};

export default Step1Admission;

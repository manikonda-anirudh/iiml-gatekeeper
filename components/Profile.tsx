import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { backendService } from '../services/backendService';
import { Button } from './Button';

interface Props {
  user: User;
  onUpdate: (updatedUser: User) => void;
}

export const Profile: React.FC<Props> = ({ user, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    mobileNumber: user.mobileNumber || '',
    hostelRoomNo: user.hostelRoomNo || '',
    emergencyContact: user.emergencyContact || '',
  });

  // Check if profile is incomplete
  const isProfileIncomplete = !formData.mobileNumber || !formData.hostelRoomNo || !formData.emergencyContact;

  // Update form data when user changes
  useEffect(() => {
    setFormData({
      mobileNumber: user.mobileNumber || '',
      hostelRoomNo: user.hostelRoomNo || '',
      emergencyContact: user.emergencyContact || '',
    });
  }, [user]);

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(false);
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    setIsLoading(true);

    try {
      const updatedUser = await backendService.updateUserProfile(user.id, {
        mobileNumber: formData.mobileNumber.trim() || undefined,
        hostelRoomNo: formData.hostelRoomNo.trim() || undefined,
        emergencyContact: formData.emergencyContact.trim() || undefined,
      });

      // Update the user in parent component
      onUpdate(updatedUser as User);
      setIsEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      mobileNumber: user.mobileNumber || '',
      hostelRoomNo: user.hostelRoomNo || '',
      emergencyContact: user.emergencyContact || '',
    });
    setIsEditing(false);
    setError(null);
    setSuccess(false);
  };

  return (
    <div className="space-y-6">
      {/* Action Required Banner */}
      {isProfileIncomplete && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-exclamation-triangle text-amber-600 text-xl"></i>
            <div>
              <h3 className="font-bold text-amber-900">Action Required: Incomplete Profile</h3>
              <p className="text-sm text-amber-800">
                Please update your Mobile, Hostel Room, and Emergency Contact details to use gate services.
              </p>
            </div>
          </div>
          {!isEditing && (
            <Button
              variant="outline"
              onClick={() => setIsEditing(true)}
              className="bg-amber-600 text-black border-amber-600 hover:bg-amber-700"
            >
              Update Now
            </Button>
          )}
        </div>
      )}

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <i className="fa-solid fa-check-circle"></i>
          <span>Profile updated successfully!</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <i className="fa-solid fa-exclamation-circle"></i>
          <span>{error}</span>
        </div>
      )}

      {/* Profile Information Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-800">Student Profile</h2>
            {!isEditing && (
              <Button
                variant="primary"
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2"
              >
                <i className="fa-solid fa-pencil"></i>
                Edit Details
              </Button>
            )}
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Academic Records (Locked) */}
            <div>
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                <i className="fa-solid fa-graduation-cap"></i>
                Academic Records <span className="text-slate-400 normal-case">(LOCKED)</span>
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Student ID</label>
                  <input
                    type="text"
                    value={user.studentId || ''}
                    disabled
                    className="w-full border border-slate-200 bg-slate-100 p-2 rounded text-sm text-slate-600 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={user.name || ''}
                    disabled
                    className="w-full border border-slate-200 bg-slate-100 p-2 rounded text-sm text-slate-600 cursor-not-allowed"
                  />
                </div>
                {user.department && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Department</label>
                    <input
                      type="text"
                      value={user.department}
                      disabled
                      className="w-full border border-slate-200 bg-slate-100 p-2 rounded text-sm text-slate-600 cursor-not-allowed"
                    />
                  </div>
                )}
                {user.instituteEmail && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Institute Email</label>
                    <input
                      type="email"
                      value={user.instituteEmail}
                      disabled
                      className="w-full border border-slate-200 bg-slate-100 p-2 rounded text-sm text-slate-600 cursor-not-allowed"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Personal Details */}
            <div>
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                <i className="fa-solid fa-user"></i>
                Personal Details
              </h3>
              <div className="space-y-4">
                {user.personalEmail && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Personal Email</label>
                    <input
                      type="email"
                      value={user.personalEmail}
                      disabled
                      className="w-full border border-slate-200 bg-slate-100 p-2 rounded text-sm text-slate-600 cursor-not-allowed"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  {isEditing ? (
                    <input
                      type="tel"
                      className={`w-full border p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-iim-green ${
                        !formData.mobileNumber ? 'border-red-300 focus:border-red-300' : 'border-slate-300'
                      }`}
                      placeholder="Enter mobile number"
                      value={formData.mobileNumber}
                      onChange={(e) => handleInputChange('mobileNumber', e.target.value)}
                      required
                    />
                  ) : (
                    <input
                      type="text"
                      value={formData.mobileNumber || ''}
                      disabled
                      className={`w-full border p-2 rounded text-sm ${
                        !formData.mobileNumber ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-100'
                      } text-slate-600 cursor-not-allowed`}
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Hostel & Room No <span className="text-red-500">*</span>
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      className={`w-full border p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-iim-green ${
                        !formData.hostelRoomNo ? 'border-red-300 focus:border-red-300' : 'border-slate-300'
                      }`}
                      placeholder="e.g. Hostel 1, Room 105"
                      value={formData.hostelRoomNo}
                      onChange={(e) => handleInputChange('hostelRoomNo', e.target.value)}
                      required
                    />
                  ) : (
                    <input
                      type="text"
                      value={formData.hostelRoomNo || ''}
                      disabled
                      className={`w-full border p-2 rounded text-sm ${
                        !formData.hostelRoomNo ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-100'
                      } text-slate-600 cursor-not-allowed`}
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Emergency Contact <span className="text-red-500">*</span>
                  </label>
                  {isEditing ? (
                    <input
                      type="tel"
                      className={`w-full border p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-iim-green ${
                        !formData.emergencyContact ? 'border-red-300 focus:border-red-300' : 'border-slate-300'
                      }`}
                      placeholder="Parent/Guardian Mobile"
                      value={formData.emergencyContact}
                      onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                      required
                    />
                  ) : (
                    <input
                      type="text"
                      value={formData.emergencyContact || 'Parent/Guardian Mobile'}
                      disabled
                      className={`w-full border p-2 rounded text-sm ${
                        !formData.emergencyContact ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-100'
                      } text-slate-600 cursor-not-allowed`}
                    />
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-4 italic">
                * Fields marked are mandatory for gate exit permissions.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {isEditing && (
          <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              isLoading={isLoading}
              disabled={isLoading}
            >
              Save Changes
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { userService, User } from '../../../api/firebase/user';
import { Search, X } from 'lucide-react';

interface MultiUserSelectorProps {
  selectedUserIds: string[];
  onUserSelect: (userId: string) => void;
  onUserRemove: (userId: string) => void;
}

export const MultiUserSelector: React.FC<MultiUserSelectorProps> = ({
  selectedUserIds,
  onUserSelect,
  onUserRemove,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const fetchedUsers = await userService.getAllUsers();
        setUsers(fetchedUsers);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching users:', error);
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !selectedUserIds.includes(user.id)
  );

  const selectedUsers = users.filter(user => selectedUserIds.includes(user.id));

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          placeholder="Search creators..."
          className="w-full p-4 pl-11 bg-zinc-900 text-white rounded-lg border border-zinc-700 
                    focus:border-[#E0FE10] transition-colors"
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
      </div>

      {/* Search Results */}
      {showResults && searchTerm && (
        <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto bg-zinc-800 rounded-lg border border-zinc-700 shadow-xl">
          {loading ? (
            <div className="p-3 text-zinc-400">Loading creators...</div>
          ) : filteredUsers.length > 0 ? (
            filteredUsers.map(user => (
              <button
                key={user.id}
                onClick={() => {
                  onUserSelect(user.id);
                  setSearchTerm('');
                  setShowResults(false);
                }}
                className="w-full p-3 text-left hover:bg-zinc-700 text-white flex items-center space-x-3"
              >
                {user.profileImage?.profileImageURL && (
                  <img
                    src={user.profileImage.profileImageURL}
                    alt={user.username}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                )}
                <span>{user.username}</span>
              </button>
            ))
          ) : (
            <div className="p-3 text-zinc-400">No creators found</div>
          )}
        </div>
      )}

      {/* Selected Users */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {selectedUsers.map(user => (
            <div
              key={user.id}
              className="flex items-center gap-2 bg-zinc-800 rounded-full pl-2 pr-3 py-1"
            >
              {user.profileImage?.profileImageURL && (
                <img
                  src={user.profileImage.profileImageURL}
                  alt={user.username}
                  className="w-6 h-6 rounded-full object-cover"
                />
              )}
              <span className="text-sm text-white">{user.username}</span>
              <button
                onClick={() => onUserRemove(user.id)}
                className="text-zinc-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
import React from 'react';
import AdminSidebar from './AdminSidebar';

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  title,
  subtitle,
  icon,
  actions
}) => {
  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 via-purple-50/30 to-rose-50/30">
      <AdminSidebar />
      
      <div className="flex-1 transition-all duration-300 ml-[80px] lg:ml-64 p-8 overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-blue-900 flex items-center">
              {icon && <div className="w-8 h-8 mr-3 text-blue-600">{icon}</div>}
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-blue-600/80">{subtitle}</p>
            )}
          </div>
          
          {actions && (
            <div className="flex items-center space-x-4">
              {actions}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AdminLayout; 
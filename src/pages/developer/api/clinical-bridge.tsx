import type { GetServerSideProps } from 'next';
import DeveloperDocumentPage from '../../../components/developer/DeveloperDocumentPage';
export default DeveloperDocumentPage;
export const getServerSideProps:GetServerSideProps=async context=>{
 const {getDeveloperDocumentPageProps}=await import('../../../lib/developerDocsServer');
 return getDeveloperDocumentPageProps('clinical-bridge',context);
};

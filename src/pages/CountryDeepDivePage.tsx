import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import CountryDeepDive from '@/components/CountryDeepDive';
import { Loader2 } from 'lucide-react';

export default function CountryDeepDivePage() {
  const { iso3 } = useParams<{ iso3: string }>();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      if (!iso3) return;
      
      setIsLoading(true);
      try {
        const { data: profileData, error: profileError } = await supabase.functions.invoke('country-profile', {
          body: { query: iso3 }
        });

        if (profileError) throw profileError;
        
        if (profileData && profileData.ok) {
          setData(profileData);
        } else {
          setError('Failed to load country profile');
        }
      } catch (err: any) {
        console.error('Error fetching profile:', err);
        setError(err.message || 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, [iso3]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Error</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  return <CountryDeepDive {...data} />;
}

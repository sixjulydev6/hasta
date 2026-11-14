import { ChapterTabs } from '@/components/hasta/ChapterTabs';
import { HastaRuntime } from '@/components/hasta/HastaRuntime';
import { SiteFooter } from '@/components/hasta/SiteFooter';
import { SmoothScroll } from '@/components/hasta/SmoothScroll';
import { Stage } from '@/components/hasta/Stage';
import { Story } from '@/components/hasta/Story';
import { TopBar } from '@/components/hasta/TopBar';

const HomePage = () => (
  <>
    <Stage />
    <TopBar />
    <ChapterTabs />
    <Story />
    <SiteFooter />
    <HastaRuntime />
    <SmoothScroll />
  </>
);

export default HomePage;

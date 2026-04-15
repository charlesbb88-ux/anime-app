import type { NextPage, GetServerSideProps } from "next";

type MangaPageProps = {
  initialBackdropUrl: string | null;
};

const MangaPage: NextPage<MangaPageProps> = () => {
  return (
    <div
      style={{
        padding: 40,
        fontSize: 32,
        fontWeight: 700,
      }}
    >
      TEST PAGE SHOWED UP
    </div>
  );
};

(MangaPage as any).headerTransparent = true;

export default MangaPage;

export const getServerSideProps: GetServerSideProps<MangaPageProps> = async () => {
  return {
    props: {
      initialBackdropUrl: null,
    },
  };
};
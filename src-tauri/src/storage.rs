use littlefs2::consts::{U1, U8192};
use littlefs2::driver::Storage;

pub struct FlashStorage {
    pub buf: Vec<u8>,
}

impl FlashStorage {
    pub fn new(data: Vec<u8>) -> Self {
        let mut buf = data;
        buf.resize(8192 * 32, 0xFF);
        Self { buf }
    }
}

impl Storage for FlashStorage {
    const READ_SIZE: usize = 1;
    const WRITE_SIZE: usize = 1;
    const BLOCK_SIZE: usize = 8192;
    const BLOCK_COUNT: usize = 32;
    const BLOCK_CYCLES: isize = -1;
    type CACHE_SIZE = U8192;
    type LOOKAHEAD_SIZE = U1;

    fn read(&mut self, off: usize, buf: &mut [u8]) -> littlefs2::io::Result<usize> {
        buf.copy_from_slice(&self.buf[off..off + buf.len()]);
        Ok(buf.len())
    }

    fn write(&mut self, off: usize, data: &[u8]) -> littlefs2::io::Result<usize> {
        self.buf[off..off + data.len()].copy_from_slice(data);
        Ok(data.len())
    }

    fn erase(&mut self, off: usize, len: usize) -> littlefs2::io::Result<usize> {
        for b in &mut self.buf[off..off + len] {
            *b = 0xFF;
        }
        Ok(len)
    }
}
